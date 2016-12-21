-- may be needed in the future
--local https = require 'ssl.https'
local JSON = require 'cjson'

-- This script assumes that the files are all under /var/www/html
--
-- It reads:
-- LDAP for unix and PMC groups and asf-pgpKeyFingerprint from people
-- 
-- It creates:
-- /var/www/html/keys/committer/{uid}.asc
-- /var/www/html/keys/committer/index.html
-- /var/www/html/keys/group/index.html
-- /var/www/html/keys/group/{group}.asc
-- /var/www/html/keys/tmp.asc

local PUBLIC_JSON = "/var/www/html/public/"

local function readJSON(file)
    local f = io.open(PUBLIC_JSON .. file, "rb")
    local contents = f:read("*all")
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
    for k, v in pairs(pmcGroups) do
        table.insert(pmcs, k)
    end
    return pmcs
end

local people = readJSON("public_ldap_people.json").people
local keys = {}
local committers = {}

local TMPFILE = "/var/www/html/keys/tmp.asc"

for uid, entry in pairs(people) do
    os.remove("/var/www/html/keys/committer/" .. uid .. ".asc")
    table.insert(committers, uid)
    for _, key in pairs(entry.key_fingerprints or {}) do
      local skey = key:gsub("%s+", "")
      -- INFRA-12042 use only full fingerprints
      if string.len(skey) == 40 then
        local url = ([[https://sks-keyservers.net/pks/lookup?op=get&options=mr&search=0x%s]]):format(skey)
        -- https.request doesn't work :( so we'll curl for now
        local p = io.popen(("curl --silent \"%s\""):format(url))
        local rv = p:read("*a")
        p:close()
        if rv and #rv > 0 then
            keys[uid] = keys[uid] or {}
            local data = rv:match("BEGIN PGP PUBLIC KEY BLOCK") and rv or nil
            if data then
                -- only store the key id if it was found
                table.insert(keys[uid], key)
                print("Writing key " .. key .. " for " .. uid .. "...")
                
                -- get gpg uid
                local tmp = io.open(TMPFILE, "w")
                tmp:write(data)
                tmp:close()
                
                local ud = io.popen("gpg -n --with-fingerprint " .. TMPFILE, "r")
                local id = ud:read("*a")
                ud:close()

                os.remove(TMPFILE)
                
                
                local f = io.open("/var/www/html/keys/committer/" .. uid .. ".asc", "a")
                f:write("ASF ID: " .. uid .. "\n")
                f:write("LDAP PGP key: " .. key .. "\n\n")
                f:write(id)
                f:write("\n")
                f:write(data)
                f:write("\n")
                f:close()
            end
        end
      else
        print(("Invalid key %s for user %s"):format(key,uid))
      end
    end
end

local f = io.open("/var/www/html/keys/committer/index.html", "w")
f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
f:write("<h3>committer signatures:</h3>\n")

table.sort(committers)
for k, v in pairs(committers) do
    if keys[v] then
        for x, y in pairs(keys[v]) do
            f:write(("%30s <a href='%s.asc'>%s</a>\n"):format(v, v, y))
        end
    end
end
f:write(("\nGenerated: %s UTC\n"):format(os.date("!%Y-%m-%d %H:%M")))
f:write("</pre></body></html>")
f:close()

-- Add Project ASCs
print("Creating project key files")
local f = io.open("/var/www/html/keys/group/index.html", "w")
f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
f:write("<h3>Project signatures:</h3>\n")
local projects = getCommittees()
table.sort(projects)
for k, project in pairs(projects) do
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
local p = io.popen(("curl --silent \"https://whimsy.apache.org/public/public_nonldap_groups.json\""))
local rv = p:read("*a")
p:close()
if rv and #rv > 0 then
    local js = JSON.decode(rv)
    local pods = {}
    for project, entry in pairs(js.groups) do
        local committers = entry.roster
        if entry.podling and entry.podling == "current" then
            local af = io.open("/var/www/html/keys/group/" .. project .. ".asc", "w")
            for k, uid in pairs(committers) do
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
    for i,project in pairs(pods) do
        f:write(("%40s <a href='%s.asc'>%s signatures</a>\n"):format(project, project, project))
    end
end

f:write(("\nGenerated: %s UTC\n"):format(os.date("!%Y-%m-%d %H:%M")))
f:write("</pre></body></html>")
f:close()

print("Done!")

