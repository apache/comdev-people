#!/usr/bin/env python3

"""
   Script to generate files of PGP keys for committers
   Also creates indexes by committer name

   It reads the following files from /var/www/html/public/:
   public_ldap_people.json - uids and fingerPrints

   It creates:
   /var/www/html/keys/committer/{uid}.asc
   /var/www/html/keys/committer/index.html
   /var/www/html/keys/committer/keys.json

    It updates:
   /var/www/tools/pgpkeys - keyring
"""

import os
import sys
import time
import re
import json
import subprocess
from collections import defaultdict
from more_itertools import split_before

def fremove(file):
    if os.path.isfile(file):
        os.remove(file)

BASE = '/var/www' # default base (overrideable for local testing)
DOW = time.strftime('%w') # generate rolling logs over 7 days (0 = Sunday)
LOG = f"{BASE}/html/keys/pgp{DOW}.log"
fremove(LOG)
print(f"Log file {LOG}")
log = open(LOG, "w", encoding='utf-8')
log.write(time.asctime()+"\n")

#PGP interface

# using --batch causes gpg to write some output to log-file instead of stderr
GPG_ARGS = f"gpg --keyring {BASE}/tools/pgpkeys --no-default-keyring --no-tty --quiet --batch --no-secmem-warning --display-charset utf-8 --keyserver-options no-honor-keyserver-url "
GPG_SERVER_1 = "keyserver.ubuntu.com"
GPG_SERVER_2 = "keys.openpgp.org"

# GPG exits with status 2 if just one of the refresh fetches fails
# list-keys/--fingerprint only fails if all specified keys are unavailable; does not write to logger; reports to stderr
# export ditto
# recv-keys: writes to logger and stderr if one key fails; stderr has the most useful output
# ditto refresh; most useful output is on stderr
# It looks like redirecting stderr to stdout in combination with logger-file will work.
# If command status is failure,: output is the error message otherwise it is the result (if any)
# Some failures don't set error status, e.g. --recv-key can report success with the message:
# gpg: key xxxxxxx: new key but contains no user ID - skipped

def pgpfunc(func, *args):
    success, grv = pgpfunc_one(GPG_SERVER_1, func, *args)
    # only retry recv-keys:
    # does not make sense to retry --refresh (takes too long)
    # other functions don't use the server
    if not success:
        if func == '--recv-keys':
            log.write("Main server failed, trying backup\n")
            success, grv = pgpfunc_one(GPG_SERVER_2, func, *args)
            if success: # does this ever happen? - YES!
                log.write("** Backup server success! **\n")
    return success, grv

def pgpfunc_one(gpg_server, func, *args):
    params = " ".join([func] + list(args))
    log.write(f"Server: {gpg_server} command {params}\n")
    command = GPG_ARGS + "--keyserver " + gpg_server + " " + params
    cpi = subprocess.run(command.split(' '), capture_output=True, check=False, encoding='utf-8')
    grv = cpi.stdout
    success = cpi.returncode == 0
    if success and func == '--recv-keys':
        # there should be no output from a successful fetch
        success = len(cpi.stderr) == 0 and len(grv) == 0
    if not success:
        log.write(f"{success} {cpi.stderr} {grv}\n")
        grv = grv or cpi.stderr # ensure we return the error message

    return success, grv

PUBLIC_JSON = f"{BASE}/html/public/"
COMMITTER_KEYS = f"{BASE}/html/keys/committer"

def readJSON(file):
    with open(os.path.join(PUBLIC_JSON, file), 'r', encoding='utf-8') as i:
        return json.load(i)

# get the current set of keys in the database
dbkeys={} # fingerprint entries from pgp database
dbkeyct = 0
ok, fps = pgpfunc('--fingerprint') # fetch all the fingerprints
if ok:
    # scan the output looking for fps
    lines = fps.split("\n")[2:] # Drop the header
    for keyblock in split_before(lines, lambda l: l.startswith('pub')):
        fp = keyblock[1].replace(' ', '')
        dbkeys[fp] = [ l for l in keyblock if len(l) > 0]
        dbkeyct += 1

people = readJSON("public_ldap_people.json")
keys = defaultdict(list) # user keys with data in pgp database
validkeys = {} # user keys with valid syntax
badkeys = {} # [uid][key]=failure reason
committers = {}

failed = 0 # how many keys did not fetch OK
invalid = 0 # how many keys did not validate
newkeys = 0 # how many new keys fetched

hasArg1 = len(sys.argv) > 1
noRefresh = hasArg1 and sys.argv[1] == '--no-refresh' # skip refresh
gpgLocal = hasArg1 and sys.argv[1] == '--gpg-local' # don't try to download keys (for testing)

# refresh is expensive, only do it once a week
if DOW == "1" and not noRefresh and not gpgLocal:
    print("Refreshing the pgp database...")
    log.write("Refreshing the pgp database\n")
    pgpfunc('--refresh') # does not seem to have useful status/stderr output
    log.write(f"{time.asctime()} ...done\n")
    print("...done")
    
# Drop any .asc files older than a couple of days
# They are presumably for uids that no longer exist
# Current files are recreated each time
log.write("Scanning for outdated .asc files\n")
now = time.time()
for filename in os.listdir(COMMITTER_KEYS):
    if filename.endswith('asc'):
        filepath = os.path.join(COMMITTER_KEYS, filename)
        if os.path.getmtime(filepath) < now - 2 * 86400:
            if os.path.isfile(filepath):
                log.write(f"Dropping old file {filename}\n")
                os.remove(filepath)

for uid, entry in people['people'].items():
    ascfile = os.path.join(COMMITTER_KEYS, uid + ".asc")
    fremove(ascfile)
    committers[uid] = 1
    badkeys[uid] = {}
    for key in entry.get('key_fingerprints', []):
        skey = re.sub("[^0-9a-fA-F]",'', key) # Why strip all invalid chars?
        data = 'key not found in database'
        ok = False
        # INFRA-12042 use only full fingerprints
        # Note: 32 char keys are obsolete V3 ones which aren't available over HKP anyway
        if len(skey) == 40:
            validkeys[skey.upper()] = 1  # fps in pgp database are upper case
            entry = dbkeys.get(skey.upper())
            if entry: # we already have the fingerprint data
                ok = True
                data = "\n".join(entry)
            elif not gpgLocal:
                log.write(f"Fetching key {skey} for {uid}...\n")
                ok, res = pgpfunc('--recv-keys', skey)
                if ok:
                    log.write("User: %s key %s - fetched from remote\n" % (uid, skey))
                    newkeys = newkeys +1
                    ok, data = pgpfunc('--fingerprint', skey)
                    data = data.strip() # strip to match cached data
                    # LATER? dbkeys[skey.upper()] = data.split("\n") # update the fps cache
                else:
                    log.write("User: %s key %s - fetch failed: (%s) %s\n" % (uid, skey, str(ok), res))
            found = False
            badkey = False

            if ok:
                badkey = re.match("pub   .+\\[(revoked|expired): ", data)
                if badkey:
                    log.write("User: %s key %s - invalid (%s)\n" % (uid, key, badkey.group(1)))
                    invalid = invalid + 1
                    badkeys[uid][key] = "invalid key (%s)" % badkey.group(1)
                else:
                    # Note: Python multi-line search with ^ and $ is noticeably slower
                    foundkey = re.search("\n      [0-9a-fA-F ]+\n", data)
                    if foundkey:
                        ok, body = pgpfunc('--export', '--armor', skey)
                        if ok:
                            # only store the key id if it was found
                            found = True
                            keys[uid].append(key)
                            log.write("Writing key " + key + " for " + uid + "...\n")
                            with open(ascfile, "a", encoding='utf-8') as f:
                                f.write("ASF ID: " + uid + "\n")
                                f.write("LDAP PGP key: " + key + "\n\n")
                                f.write(data)
                                f.write("\n\n\n")
                                f.write(body)
                                f.write("\n")
                        else:
                            log.write("User: %s key %s - export failed:\n%s\n" % (uid, skey, body))
                    else:
                        log.write("User: %s key %s - could not extract fingerprint:\n%s\n" % (uid, skey, data))
            else:
                log.write("User: %s key %s - fingerprint failed:\n%s\n" % (uid, skey, data))
            # if badkey,: it has already been reported
            if not found and not badkey:
                log.write("User: %s key %s - not found\n" % (uid, skey))
                failed = failed + 1
                badkeys[uid][key] = 'key not found'
        else:
            log.write("User: %s key %s - invalid (expecting 40 hex chars)\n" % (uid, key))
            invalid = invalid + 1
            badkeys[uid][key] = 'invalid key (expecting 40 hex chars)'


for key in dbkeys:
    if not key in validkeys:
        ok, res = pgpfunc('--delete-keys', key)
        if ok:
            log.write("Dropped unused key %s\n" % (key))
        else:
            log.write("Failed to drop unused key %s - %s\n" % (key, res))

log.write("lastCreateTimestamp: %s\n" % (people.get('lastCreateTimestamp','?')))
log.write("Failed fetches: %d\n" % (failed))
log.write("Invalid keys: %d\n" % (invalid))
log.write("New keys: %d\n" % (newkeys))
log.write(time.asctime()+"\n")
log.close()

f = open(os.path.join(COMMITTER_KEYS, "index.html"), "w", encoding='utf-8')
f.write("""<html>
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
  <tbody>""")

entryok = """
    <tr>
      <td><a href='/phonebook.html?uid=%s'>%s</a></td>
      <td><a id='%s' href='%s.asc'>%s</a></td>
      <td>&nbsp;</td>
    </tr>"""

entrybad = """
    <tr>
      <td><a href='/phonebook.html?uid=%s'>%s</a></td>
      <td><a id='%s'>%s</a></td>
      <td>%s</td>
    </tr>"""

# Generate a summary for external use (e.g. Whimsy)
summary = defaultdict(dict)
summary['_info_']['epochsecs'] = int(time.time())
for v in sorted(committers):
    if v in keys:
        for y in keys[v]:
            f.write(entryok % (v,v,v,v,(y.replace(' ','&nbsp;'))))
            summary[v][y] = 'ok'
    for k, r in badkeys[v].items():
        f.write(entrybad % (v,v,v,k,r))
        summary[v][k] = r

with open(os.path.join(COMMITTER_KEYS, "keys.json"), 'w', encoding='utf-8') as s:
    json.dump(summary, s, indent=2, sort_keys=True)

f.write("""
  </tbody>
</table>
<pre>""")

f.write("\nGenerated: %s UTC\n" % (time.strftime("%Y-%m-%d %H:%M",time.gmtime())))
f.write("\nlastCreateTimestamp: %s\n" % (people.get('lastCreateTimestamp','?')))
f.write("Failed fetches: %d\n" % (failed))
f.write("Invalid keys: %d\n" % (invalid))
f.write("New keys: %d\n" % (newkeys))
f.write("</pre></body></html>")
f.close()

print("Done!")
