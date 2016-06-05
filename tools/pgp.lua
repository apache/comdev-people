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

-- Return all members of a project + PMC separately and as a set
function getMembers(project)
    print("Getting the members of project " .. project)
    local committers = {}
    local pmc = {}
    
    local ldapdata = io.popen( ([[ldapsearch -x -LLL -b "cn=%s,ou=groups,dc=apache,dc=org" memberUid]]):format(project) )
    local data = ldapdata:read("*a")
    ldapdata:close()
    for match in data:gmatch("memberUid: ([-.a-zA-Z0-9]+)") do
        table.insert(committers, match)
    end
    
    local ldapdata = io.popen( ([[ldapsearch -x -LLL -b "cn=%s,ou=pmc,ou=committees,ou=groups,dc=apache,dc=org" member]]):format(project) )
    local data = ldapdata:read("*a")
    ldapdata:close()
    for match in data:gmatch("member: uid=([-.a-zA-Z0-9]+)") do
        table.insert(pmc, match)
    end
    
    -- Sometimes, LDAP fails and returns everything - we don't want that
    if #committers > 4500 then committers = {} end
    if #pmc > 4500 then pmc = {} end
    local set = {}
    for _, v in ipairs(pmc) do set[v] = 1 end
    for _, v in ipairs(committers) do set[v] = 1 end
    return committers, pmc, set
end


-- Return all PMCs
function getCommittees()
    print("Getting all committees ")
    local pmcs = {}
    local ldapdata = io.popen([[ldapsearch -x -LLL -b ou=pmc,ou=committees,ou=groups,dc=apache,dc=org cn]])
    local data = ldapdata:read("*a")
    ldapdata:close()
    for match in data:gmatch("cn: ([-.a-zA-Z0-9]+)") do
        table.insert(pmcs, match)
    end
    return pmcs
end

local ldapdata = io.popen([[ldapsearch -x -LLL -b ou=people,dc=apache,dc=org asf-pgpKeyFingerprint]])
local data = ldapdata:read("*a")
local keys = {}
local committers = {}

TMPFILE = "/var/www/html/keys/tmp.asc"

data = data .. "\ndn" -- RE expects to find this after every entry, including the last
for uid, rest in data:gmatch("uid=([-._a-z0-9]+),ou=people,dc=apache,dc=org\r?\n?(.-)\r?\ndn") do
    os.remove("/var/www/html/keys/committer/" .. uid .. ".asc")
    table.insert(committers, uid)
    for key in rest:gmatch("asf%-pgpKeyFingerprint: ([a-f0-9A-F \t]+)") do
      skey = key:gsub("%s+", "")
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

