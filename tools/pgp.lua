--[[
   Script to generate files of PGP keys for committers
   Also creates indexes by committer name

   It reads the following files from /var/www/html/public/:
   public_ldap_people.json - uids and fingerPrints
   
   It creates:
   /var/www/html/keys/committer/{uid}.asc
   /var/www/html/keys/committer/index.html
   /var/www/tools/pgpkeys - keyring
]]

local JSON = require 'cjson'

local DOW = math.floor(os.time()/86400)%7 -- generate rolling logs over 7 days
local LOG = ([[/var/www/html/keys/pgp%d.log]]):format(DOW)
os.remove(LOG)
print("Log file " .. LOG)
local log = io.open(LOG, "w")
log:write(os.date(),"\n")

--PGP interface

-- using --batch causes gpg to write some output to log-file instead of stderr
local GPG_ARGS = "gpg --keyring /var/www/tools/pgpkeys --no-default-keyring --no-tty --quiet --batch --no-secmem-warning --display-charset utf-8 --keyserver-options no-honor-keyserver-url "
local GPG_SERVER_1 = "keyserver.ubuntu.com"
local GPG_SERVER_2 = "keys.openpgp.org"

-- Unfortunately GPG writes messages to stderr and Lua does not handle that in io.popen
-- --logger-fd/logger-file can be used to redirect the progress (and some error-related) messages
-- Does not seem to be a way to redirect errors except by using the shell
-- Also GPG exits with status 2 if just one of the refresh fetches fails
-- list-keys/--fingerprint only fails if all specified keys are unavailable; does not write to logger; reports to stderr
-- export ditto
-- recv-keys: writes to logger and stderr if one key fails; stderr has the most useful output
-- ditto refresh; most useful output is on stderr
-- It looks like redirecting stderr to stdout in combination with logger-file will work.
-- If command status is failure, then output is the error message otherwise it is the result (if any)
-- Some failures don't set error status, e.g. --recv-key can report success with the message:
-- gpg: key xxxxxxx: new key but contains no user ID - skipped
local function pgpfunc(func, ...)
    local success, grv = pgpfunc_one(GPG_SERVER_1, func, ...)
    -- only retry recv-keys:
    -- does not make sense to retry --refresh (takes too long)
    -- other functions don't use the server
    if not success then
        if func == '--recv-keys' then
            log:write("Main server failed, trying backup\n")
            success, grv = pgpfunc_one(GPG_SERVER_2, func, ...)
            if success then -- does this ever happen?
                log:write("** Backup server success! **\n")
            end
        end
    end
    return success, grv
end


function pgpfunc_one(gpg_server, func, ...)
    log:write(("Server: %s command %s\n"):format(gpg_server, table.concat({func,...},' ')))
    local command = GPG_ARGS .. "--keyserver " .. gpg_server .. " " .. func
    for _, v in ipairs({...}) do
        command = command .. " " .. v
    end
    command = command .. " 2>&1"
    local gp = io.popen(command)
    local grv = gp:read("*a") -- slurp result
    local success, exitOrSignal, code = gp:close()
    if success and func == '--recv-keys' then
        -- there should be no output from a successful fetch
        success = string.len(grv) == 0
    end
    if not success then
        log:write(tostring(success), " ", exitOrSignal, " ",  code, " ", grv, "\n")
    end
    return success, grv
end


local PUBLIC_JSON = "/var/www/html/public/"

local function readJSON(file)
    local f = io.open(PUBLIC_JSON .. file, "rb")
    local contents = f:read("*a")
    f:close()
    return JSON.decode(contents)
end

function pairsByKeys (t, f)
      local a = {}
      for n in pairs(t) do table.insert(a, n) end
      table.sort(a, f)
      local i = 0      -- iterator variable
      local iter = function ()   -- iterator function
        i = i + 1
        if a[i] == nil then return nil
        else return a[i], t[a[i]]
        end
      end
      return iter
    end

-- get the current set of keys in the database
local dbkeys={} -- squashed fpkeys from LDAP
local dbkeyct = 0
local ok, fps = pgpfunc('--fingerprint') -- fetch all the fingerprints
if ok then
    -- scan the output looking for fps
    for key in fps:gmatch("      ([0-9a-fA-F ]+)\n") do
        dbkeys[(key:gsub(' ',''))]=1 -- extra () are to throw away the subs count
        dbkeyct = dbkeyct + 1
    end
end

local people = readJSON("public_ldap_people.json")
local keys = {} -- user keys with data in pgp database
local validkeys = {} -- user keys with valid syntax 
local badkeys = {} -- [uid][key]=failure reason
local committers = {}

local failed = 0 -- how many keys did not fetch OK
local invalid = 0 -- how many keys did not validate
local newkeys = 0 -- how many new keys fetched
local noRefresh = arg[1] == '--no-refresh' -- skip refresh
local gpgLocal = arg[1] == '--gpg-local' -- don't try to download keys (for local testing)

-- refresh is expensive, only do it once a week
if DOW == 4 and not noRefresh and not gpgLocal then
    print("Refreshing the pgp database...")
    log:write("Refreshing the pgp database\n")
    pgpfunc('--refresh') -- does not seem to have useful status/stderr output
    print("...done")
end

for uid, entry in pairs(people.people) do
    os.remove("/var/www/html/keys/committer/" .. uid .. ".asc")
    table.insert(committers, uid)
    badkeys[uid] = {}
    for _, key in pairs(entry.key_fingerprints or {}) do
        local skey = key:gsub("[^0-9a-fA-F]", "")
        -- INFRA-12042 use only full fingerprints
        -- Note: 32 char keys are obsolete V3 ones which aren't available over HKP anyway
        if string.len(skey) == 40 then
            validkeys[skey:upper()] = 1 -- fps in pgp database are upper case
            if not dbkeys[skey:upper()] and not gpgLocal then
                log:write("Fetching key " .. skey .. " for " .. uid .. "...\n")
                local ok, res = pgpfunc('--recv-keys', skey)
                if ok then
                    log:write(("User: %s key %s - fetched from remote\n"):format(uid, skey))
                    newkeys = newkeys +1
                else
                    log:write(("User: %s key %s - fetch failed: (%s) %s\n"):format(uid, skey, tostring(ok), res))
                end
            end
            local found = false
            local badkey = false
             -- recheck the key in case it was downloaded OK (not very efficient!)
            local ok, data = pgpfunc('--fingerprint', skey)
            if ok then
                -- Lua does not have alternation '(revoked|expired)'', so match 1st letter and last 2
                badkey,_ = data:match("pub   .+%[([re].+ed): ")
                if badkey then
                    log:write(("User: %s key %s - invalid (%s)\n"):format(uid, key, badkey))
                    invalid = invalid + 1
                    badkeys[uid][key] = ("invalid key (%s)"):format(badkey)
                else
                    local id,_ = data:match("      ([0-9a-fA-F ]+)\n")
                    if id then
                        local ok, body = pgpfunc('--export', '--armor', skey)
                        if ok then
                            -- only store the key id if it was found
                            found = true
                            keys[uid] = keys[uid] or {}
                            table.insert(keys[uid], key)
                            log:write("Writing key " .. key .. " for " .. uid .. "...\n")
                            local f = io.open("/var/www/html/keys/committer/" .. uid .. ".asc", "a")
                            f:write("ASF ID: " .. uid .. "\n")
                            f:write("LDAP PGP key: " .. key .. "\n\n")
                            f:write(data)
                            f:write("\n")
                            f:write(body)
                            f:write("\n")
                            f:close()
                        else
                            log:write(("User: %s key %s - export failed:\n%s\n"):format(uid, skey, body))
                        end
                    else
                        log:write(("User: %s key %s - could not extract fingerprint:\n%s\n"):format(uid, skey, data))
                    end
                end
            else
                log:write(("User: %s key %s - fingerprint failed:\n%s\n"):format(uid, skey, data))
            end
            -- if badkey, then it has already been reported
            if not found and not badkey then
                log:write(("User: %s key %s - not found\n"):format(uid, skey))
                failed = failed + 1
                badkeys[uid][key] = 'key not found'
            end
        else
            log:write(("User: %s key %s - invalid (expecting 40 hex chars)\n"):format(uid, key))
            invalid = invalid + 1
            badkeys[uid][key] = 'invalid key (expecting 40 hex chars)'
        end
    end
end

for key, _ in pairs(dbkeys) do
    if not validkeys[key] then
        local ok, res = pgpfunc('--delete-keys', key)
        if ok then
            log:write(("Dropped unused key %s\n"):format(key))
        else
            log:write(("Failed to drop unused key %s - %s\n"):format(key, res))
        end
    end
end

log:write(("lastCreateTimestamp: %s\n"):format(people.lastCreateTimestamp or '?'))
log:write(("Failed fetches: %d\n"):format(failed))
log:write(("Invalid keys: %d\n"):format(invalid))
log:write(("New keys: %d\n"):format(newkeys))
log:write(os.date(),"\n")
log:close()

local f = io.open("/var/www/html/keys/committer/index.html", "w")
f:write([[
<html>
<head><title>ASF PGP Keys</title>
<link rel="stylesheet" type="text/css" href="../../css/keys.css">
</head>
<body>
<h3>committer signatures:</h3>
<table>
  <thead>
    <tr>
      <th>id</th>
      <th>fingerprint</th>
      <th>comment</th>
    </tr>
  </thead>
  <tbody>
]])

local entryok = [[
    <tr>
      <td><a href='/phonebook.html?uid=%s'>%s</a></td>
      <td><a id='%s' href='%s.asc'>%s</a></td>
      <td>&nbsp;</td>
    </tr>
]]
local entrybad = [[
    <tr>
      <td><a href='/phonebook.html?uid=%s'>%s</a></td>
      <td><a id='%s'>%s</a></td>
      <td>%s</td>
    </tr>
]]
table.sort(committers)
for _, v in pairs(committers) do
    if keys[v] then
        for _, y in pairs(keys[v]) do
            f:write(entryok:format(v,v,v,v,(y:gsub(' ','&nbsp;'))))
        end
    end
    for k, r in pairs(badkeys[v]) do
        f:write(entrybad:format(v,v,v,k,r))
    end
end
f:write([[
  </tbody>
</table>
<pre>
]])
f:write(("\nGenerated: %s UTC\n"):format(os.date("!%Y-%m-%d %H:%M")))
f:write(("\nlastCreateTimestamp: %s\n"):format(people.lastCreateTimestamp or '?'))
f:write(("Failed fetches: %d\n"):format(failed))
f:write(("Invalid keys: %d\n"):format(invalid))
f:write(("New keys: %d\n"):format(newkeys))
f:write("</pre></body></html>")
f:close()

print("Done!")
