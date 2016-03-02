local https = require 'ssl.https'

local ldapdata = io.popen([[ldapsearch -x -LLL -b ou=people,dc=apache,dc=org asf-pgpKeyFingerprint]])
local data = ldapdata:read("*a")
local keys = {}
local committers = {}
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
    local f = io.open("/var/www/html/keys/committer/index.html", "w")
    f:write("<html><head><title>ASF PGP Keys</title></head><body><pre>")
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
end

print("Done!")