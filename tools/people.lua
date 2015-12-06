local JSON = require 'cjson'


-- return a list of projects this user is a committer on
function getProjects(uid)
    local groups = {}
    local pmcs = {}
    local ldapdata = io.popen( ([[ldapsearch -x -LLL "(|(memberUid=%s)(member=uid=%s,ou=people,dc=apache,dc=org))" cn]]):format(uid,uid) )
    local data = ldapdata:read("*a")
    ldapdata:close()
    for match in data:gmatch("dn: cn=([-.a-zA-Z0-9]+),ou=groups,dc=apache,dc=org") do
        if not match:match("root%-") and not match:match("apldap") then
            table.insert(groups, match)
        end
    end
    for match in data:gmatch("dn: cn=([-.a-zA-Z0-9]+),ou=pmc,ou=committees,ou=groups,dc=apache,dc=org") do
        if not match:match("root%-") and not match:match("apldap") then
            table.insert(pmcs, match)
        end
    end
    return groups, pmcs
end


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
    
    if #committers > 4500 then committers = {} end
    if #pmc > 4500 then pmc = {} end
    return committers, pmc
end

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

function getCommitters()
    local committers = {}
    local ldapdata = io.popen([[ldapsearch -x -LLL -b ou=people,dc=apache,dc=org cn]])
    local data = ldapdata:read("*a")
    for uid, b64, name in data:gmatch("dn: uid=([-._a-z0-9]+),ou=people,dc=apache,dc=org\r?\n?cn:(:?) ([^\r\n]+)") do
        if b64 and #b64 == 1 then
            committers[uid] = "b64==" .. name
        else
            committers[uid] = name
        end
    end
    if #committers > 2000 then
        return {}
    else
        return committers
    end
end


-- get committees and folks
local s = os.time()
local committers = getCommitters()
local committeeList = getCommittees()
local projects = {}
local committees = {}

table.insert(committeeList, "member")
table.sort(committeeList)

local done = 0
local nocom = #committeeList

for k, project in pairs(committeeList) do
    local commits, pmc = getMembers(project)
    projects[project] = commits
    committees[project] = pmc
    nocom = nocom - 1
    done = done + 1
    local left = ((os.time() - s) / done) * nocom
    print(("Done with %30s - %03u remain (%02u min, %02u secs)"):format(project, nocom, math.floor(left/60), left%60))
end

local out = JSON.encode({
    committers = committers,
    projects = projects,
    committees = committees
})

local f = io.open("/var/www/html/committers.json", "w")
f:write(out)
f:close()

print("All done!")

