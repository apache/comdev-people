--[[
   Script to generate files of PGP keys for committers
   Also creates indexes by committer name and by PMC/committee group membership

   It reads the following files from /var/www/html/public/:
   public_ldap_groups.json - membership of committee group
   public_ldap_committees.json - membership of PMC
   public_ldap_people.json - uids and fingerPrints
   public_nonldap_groups.json - podlings
   
   It creates:
   /var/www/html/keys/committer/{uid}.asc
   /var/www/html/keys/committer/index.html
   /var/www/html/keys/group/index.html
   /var/www/html/keys/group/{group}.asc
]]

local JSON = require 'cjson'

local DOW = math.floor(os.time()/86400)%7 -- generate rolling logs over 7 days

local log = io.open(([[/var/www/html/keys/committer%d.log]]):format(DOW), "w")

--PGP interface

-- using --batch causes gpg to write some output to log-file instead of stderr
local GPG_ARGS = "gpg --keyring /var/www/tools/pgpkeys --no-default-keyring --no-tty --quiet --batch --no-secmem-warning --display-charset utf-8 --keyserver-options no-honor-keyserver-url "

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
local function pgpfunc(func, ...)
    local logname = ([[/var/www/html/keys/pgp%d.log]]):format(DOW)
    local command = GPG_ARGS .. "--logger-file ".. logname .." 2>&1 " .. func
    for _, v in ipairs({...}) do
        command = command .. " " .. v
    end
    log:write(command,"\n")
    local gp = io.popen(command)
    local grv = gp:read("*a") -- slurp result
    local success, exitOrSignal, code = gp:close()
    log:write(tostring(success), " ", exitOrSignal, " ",  code, "\n")
    return success, grv
end

local PUBLIC_JSON = "/var/www/html/public/"

local function readJSON(file)
    local f = io.open(PUBLIC_JSON .. file, "rb")
    local contents = f:read("*a")
    f:close()
    return JSON.decode(contents)
end

local committerGroups = readJSON("public_ldap_groups.json").groups
local pmcGroups = readJSON("public_ldap_committees.json").committees

-- Return all members of a project + PMC separately and as a set
local function getMembers(project)
    print("Getting the members of project " .. project)

    -- TAC does not have a committerGroup
    local committers = (committerGroups[project] or {}).roster or {}
    local pmc = pmcGroups[project].roster
    
    local set = {}
    for _, v in ipairs(pmc) do set[v] = 1 end
    for _, v in ipairs(committers) do set[v] = 1 end
    return committers, pmc, set
end


-- Return all PMCs
local function getCommittees()
    print("Getting all committees ")
    local pmcs = {}
    for k, _ in pairs(pmcGroups) do
        table.insert(pmcs, k)
    end
    return pmcs
end

-- get the current set of keys in the database
local dbkeys={} -- squashed fpkeys from LDAP
local dbkeyct = 0
local ok, fps = pgpfunc('--fingerprint') -- fetch all the fingerprints
if ok then
    -- scan the output looking for fps
    for key in fps:gmatch("fingerprint = ([0-9a-fA-F ]+)") do
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

if dbkeyct == 0 then
    log:write("Presetting the pgp database\n")
    for uid, entry in pairs(people.people) do
        if entry.key_fingerprints then -- it may have a .asc file
            local asc = "/var/www/html/keys/committer/" .. uid .. ".asc"
            pgpfunc('--import', asc) -- does not seem to have useful status/stderr output
        end
    end
end

-- refresh is expensive, only do it once a week
if DOW == 4 then
    log:write("Refreshing the pgp database\n")
    pgpfunc('--refresh') -- does not seem to have useful status/stderr output
end

for uid, entry in pairs(people.people) do
    os.remove("/var/www/html/keys/committer/" .. uid .. ".asc")
    table.insert(committers, uid)
    badkeys[uid] = {}
    for _, key in pairs(entry.key_fingerprints or {}) do
        local skey = key:gsub("[^0-9a-fA-F]", "")
        -- INFRA-12042 use only full fingerprints
        if string.len(skey) == 40 then
            validkeys[skey:upper()] = 1 -- fps in pgp database are upper case
            if not dbkeys[skey:upper()] then
                print("Fetching key " .. skey .. " for " .. uid .. "...")
                local ok, res = pgpfunc('--recv-keys', skey)
                if ok then
                    log:write(("User: %s key %s - fetched from remote\n"):format(uid, skey))
                    newkeys = newkeys +1
                else
                    log:write(("User: %s key %s - fetch failed: %s\n"):format(uid, skey, res))
                end
            end
            local found = false
            local ok, data = pgpfunc('--fingerprint', skey)
            if ok then
                local id,_ = data:match("fingerprint = ([0-9a-fA-F ]+)")
                if id then
                    local ok, body = pgpfunc('--export', '--armor', skey)
                    if ok then
                        -- only store the key id if it was found
                        found = true
                        keys[uid] = keys[uid] or {}
                        table.insert(keys[uid], key)
                        print("Writing key " .. key .. " for " .. uid .. "...")
                        local f = io.open("/var/www/html/keys/committer/" .. uid .. ".asc", "a")
                        f:write("ASF ID: " .. uid .. "\n")
                        f:write("LDAP PGP key: " .. key .. "\n\n")
                        f:write(id)
                        f:write("\n")
                        f:write(body)
                        f:write("\n")
                        f:close()
                    end
                end
            end
            if not found then
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

log:close()

local f = io.open("/var/www/html/keys/committer/index.html", "w")
f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
f:write("<h3>committer signatures:</h3>\n")

table.sort(committers)
for _, v in pairs(committers) do
    if keys[v] then
        for _, y in pairs(keys[v]) do
            f:write(("%30s <a href='%s.asc'>%s</a>\n"):format(v, v, y))
        end
    end
    for k, r in pairs(badkeys[v]) do
        f:write(("%30s %s - %s\n"):format(v,k,r))
    end
end
f:write(("\nGenerated: %s UTC\n"):format(os.date("!%Y-%m-%d %H:%M")))
f:write(("\nlastCreateTimestamp: %s\n"):format(people.lastCreateTimestamp or '?'))
f:write(("Failed fetches: %d\n"):format(failed))
f:write(("Invalid keys: %d\n"):format(invalid))
f:write(("New keys: %d\n"):format(newkeys))
f:write("</pre></body></html>")
f:close()

-- Add Project ASCs
print("Creating project key files")
local f = io.open("/var/www/html/keys/group/index.html", "w")
f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
f:write("<h3>Project signatures:</h3>\n")
local projects = getCommittees()
table.sort(projects)
for _, project in pairs(projects) do
    -- use the set so we get all the project members (e.g. tac has no Unix group)
    local _, _, set = getMembers(project)
    local af = io.open("/var/www/html/keys/group/" .. project .. ".asc", "w")
    for uid, _ in pairs(set) do
        local cf = io.open("/var/www/html/keys/committer/" .. uid .. ".asc", "r")
        if cf then
            local data = cf:read("*a")
            af:write(data)
            cf:close()
        end
    end
    af:close()
    f:write(("%40s <a href='%s.asc'>%s signatures</a>\n"):format(project, project, project))
end

print("Creating podling key files")
f:write("\n<h3>Podling signatures:</h3>\n")
local podlingGroups = readJSON("public_nonldap_groups.json").groups
local pods = {}
for project, entry in pairs(podlingGroups) do
    local committers = entry.roster
    if entry.podling and entry.podling == "current" then
        local af = io.open("/var/www/html/keys/group/" .. project .. ".asc", "w")
        for _, uid in pairs(committers) do
            local cf = io.open("/var/www/html/keys/committer/" .. uid .. ".asc", "r")
            if cf then
                local data = cf:read("*a")
                af:write(data)
                cf:close()
            end
        end
        af:close()
        table.insert(pods, project)
    end
end
table.sort(pods)
for _,project in pairs(pods) do
    f:write(("%40s <a href='%s.asc'>%s signatures</a>\n"):format(project, project, project))
end

f:write(("\nGenerated: %s UTC\n"):format(os.date("!%Y-%m-%d %H:%M")))
f:write("</pre></body></html>")
f:close()

print("Done!")
