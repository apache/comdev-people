local https = require 'ssl.https'


-- Return all members of a project + PMC
function getMembers(project)
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
    return committers, pmc
end


-- Return all PMCs
function getCommittees()
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
local f = io.open("/var/www/html/keys/committer/index.html", "w")
f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
f:write("<h3>committer signatures:</h3>\n")
data = data .. "\ndn" -- hack hack hack
for uid, rest in data:gmatch("uid=([-._a-z0-9]+),ou=people,dc=apache,dc=org\r?\n?(.-)\r?\ndn") do
    os.remove("/var/www/html/keys/committer/" .. uid .. ".asc")
    table.insert(committers, uid)
    for key in rest:gmatch("asf%-pgpKeyFingerprint: ([a-f0-9A-F \t]+)") do
        local url = ([[https://sks-keyservers.net/pks/lookup?op=get&search=0x%s]]):format(key:gsub("%s+", ""))
        -- https.request doesn't work :( so we'll curl for now
        local p = io.popen(("curl --silent \"%s\""):format(url))
        local rv = p:read("*a")
        p:close()
        if rv and #rv > 0 then
            keys[uid] = keys[uid] or {}
            table.insert(keys[uid], key)
            print("Writing key " .. key .. " for " .. uid .. "...")
            local data = rv:match("<pre>(.-)</pre>")
            if data then
                local f = io.open("/var/www/html/keys/committer/" .. uid .. ".asc", "a")
                f:write(data)
                f:write("\n")
                f:close()
            end
        end
    end
end
table.sort(committers)
for k, v in pairs(committers) do
    if keys[v] then
        for x, y in pairs(keys[v]) do
            f:write(("%30s <a href='%s.asc'>%s</a>\n"):format(v, v, y))
        end
    end
end
f:write("</pre></body></html>")
f:close()

-- Add Project ASCs
local f = io.open("/var/www/html/keys/group/index.html", "w")
f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
f:write("<h3>Projects signatures:</h3>\n")
local projects = getCommittees()
table.sort(projects)
for k, project in pairs(projects) do
    local committers, pmc = getMembers(project)
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
    f:write(("%40s <a href='../group/%s.asc'>%s signatures</a>\n"):format(project, project, project))
end

f:write("</pre></body></html>")
f:close()

print("Done!")