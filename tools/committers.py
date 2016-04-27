import sys
if sys.hexversion < 0x030000F0:
    raise RuntimeError("This script requires Python3")

"""
Generates:
html/committer-index.html 
html/committers-by-project.html
from json files under html/public

Expected usage in cron job:

python3 /var/www/tools/committers.py

"""

from os.path import dirname, abspath, join
from inspect import getsourcefile
import datetime
import json

MYHOME = dirname(abspath(getsourcefile(lambda:0))) # automatically work out home location
HTML_DIR=join(dirname(MYHOME),'html')
JSON_DIR=join(HTML_DIR,'public')

versions = {}

def getJson(file, stamp=None):
    with open(join(JSON_DIR, file), "r", encoding='utf-8') as f:
        j = json.loads(f.read())
        if stamp != None:
            versions[file] = [stamp, j[stamp]]
        else:
            versions[file] = ['(No timestamp info)', '']
        return j

members = getJson('member-info.json', 'last_updated')['members']
ldap_people = getJson('public_ldap_people.json', 'lastCreateTimestamp')['people']

ldap_groups = getJson('public_ldap_groups.json', 'lastTimestamp')['groups']
ldap_cttees = getJson('public_ldap_committees.json', 'lastTimestamp')['committees']
ldap_services = getJson('public_ldap_services.json', 'lastTimestamp')['services']
nonldap_groups = getJson('public_nonldap_groups.json')['groups'] # nothing
icla_info = getJson('icla-info.json', 'last_updated')['committers']

idData = {} # hash of ids; entries are group type and name
groupData = {} # hash of group names; entries are lists of committer ids

for group in ldap_groups:
    if group == 'committers':
        continue
    groupData[group] = []
    for id in ldap_groups[group]['roster']:
        groupData[group].append(id)
        try:
            idData[id].append(['unix', group])
        except KeyError:
            idData[id] = [['unix', group]]

for group in ldap_services:
    groupData[group] = []
    for id in ldap_services[group]['roster']:
        groupData[group].append(id)
        try:
            idData[id].append(['service', group])
        except KeyError:
            idData[id] = [['service', group]]

for group in nonldap_groups:
    groupData[group] = []
    for id in nonldap_groups[group]['roster']:
        groupData[group].append(id)
        try:
            idData[id].append(['other', group])
        except KeyError:
            idData[id] = [['other', group]]

for cttee in ldap_cttees:
    gname = cttee + '-pmc'
    groupData[gname] = []
    for id in ldap_cttees[cttee]['roster']:
        groupData[gname].append(id)
        try:
            idData[id].append(['pmc', cttee])
        except KeyError:
            idData[id] = [['pmc', cttee]]

def podlingName(group):
    try:
        if nonldap_groups[group]['podling'] == 'current':
            return group + " (incubating)"
        else:
            return group + " (" + nonldap_groups[group]['podling'] + ")"
    except KeyError:
        return group
        
def publicName(id):
    if id in ldap_people:
        person = ldap_people[id]
        if 'urls' in person:
            urls = person['urls']
            text = "<a href='%s'>%s</a>" % (urls[0],person['name'])
            for url in urls[1:]:
                text = text + " | <a href='%s'>+</a>" % url
            return text
        else:
            return person['name']
    else:
        return '(Unknown)'

def isMember(id):
    return id in members

def hasICLA(id):
    return id in icla_info

f = open(join(HTML_DIR,'committer-index.html'), mode='w', encoding='utf-8')

f.write("""<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>ASF Committers by id</title>
<link rel="stylesheet" type="text/css" href="css/community.css">
</head>
<body>
<div id="content">
<p>
      This page lists all known committers by login id.
      For each entry, it shows the full name and any LDAP groups / SVN groups to which they belong.
      <br/>
      This information is derived from the <a href='public'>JSON files</a> 
      which in turn are derived from LDAP and the SVN authorization file by Whimsy.
</p>
<p>
<!-- TODO
      Entries in <em>italics</em> do <b>NOT</b> have a signed 
      <a href="http://www.apache.org/licenses/#clas">Contributor License Agreement</a> on file (this knowledge is keyed by SVN id).
      <br>
-->
      Entries in <b>bold</b> are ASF members.
      <br>
      Committers may provide homepage URLs in LDAP.
      <br>
      Login to <a href="https://id.apache.org/">https://id.apache.org/</a> and populate the "Homepage URL:" field.
      Remember to provide your password (near the bottom of the page) before pressing submit.
      Any such entries are shown as links in the Name column. 
</p>
<p>
    There is also a list of <a href="unlistedclas.html">Persons with signed CLAs but who are not (yet) committers.</a>
    This is useful for checking if a CLA has been received and recorded in the 
    <a href="https://svn.apache.org/repos/private/foundation/officers/iclas.txt">iclas.txt</a> file which is maintained by the secretary.
</p>
<p>
    <a href="/keys/committer/">PGP keys of committers</a> are available.
</p>
""")

f.write("<p>Last updated at: %s</p>" % '{:%Y-%m-%d %H:%M UTC}'.format(datetime.datetime.utcnow()))

f.write("""
<hr size="1" noshade>
      <a href='#A'>A</a>
      <a href='#B'>B</a>
      <a href='#C'>C</a>
      <a href='#D'>D</a>
      <a href='#E'>E</a>
      <a href='#F'>F</a>
      <a href='#G'>G</a>
      <a href='#H'>H</a>
      <a href='#I'>I</a>
      <a href='#J'>J</a>
      <a href='#K'>K</a>
      <a href='#L'>L</a>
      <a href='#M'>M</a>
      <a href='#N'>N</a>
      <a href='#O'>O</a>
      <a href='#P'>P</a>
      <a href='#Q'>Q</a>
      <a href='#R'>R</a>
      <a href='#S'>S</a>
      <a href='#T'>T</a>
      <a href='#U'>U</a>
      <a href='#V'>V</a>
      <a href='#W'>W</a>
      <a href='#X'>X</a>
      <a href='#Y'>Y</a>
      <a href='#Z'>Z</a>
<hr size="1" noshade>
<table>
<tr>
<th>SVN id</th>
<th>Name</th>
<th>Group membership</th>
</tr>
""")

def boldMember(id, txt):
    if isMember(id):
        return "<b>%s</b>" % txt
    return txt

def notICLA(id, txt):
    if not hasICLA(id):
        return "<i>%s</i>" % txt
    return txt

def idStyle(id, txt):
    return notICLA(id, boldMember(id, txt))

# create links to phonebook groups
def linkGroup(groups):
    text = ''
    sep = ''
    for group in sorted(groups, key=lambda group: group[1]+'-'+group[0]):
        type = group[0]
        name = group[1]
        if type == 'pmc':
            name += '-pmc'
        text += sep + "<a href='phonebook.html?%s=%s'>%s</a>" % (type, group[1], name)
        sep = ', '
    return text

letter='' # Alpha index
# iterate over committers (should be sorted already)
for id in ldap_groups['committers']['roster']:
    ID1 = id[0:1].upper()
    if not ID1 == letter: # new first letter
        f.write("<tr id='%s'>" % ID1)
        letter = ID1
    else:
        f.write("<tr>")
    # SVN id
    f.write("<td id='%s'>%s</td>" % (id, idStyle(id, id)))
    # Name
    f.write("<td>%s</td>" % idStyle(id, publicName(id)))
    # groups (if any)
    if id in idData:
        f.write("<td>%s</td>" % linkGroup(idData[id]))
    else:
        f.write("<td>&nbsp</td>")
    f.write("</tr>\n")

# trailer
f.write("""</table>
<hr/>
<p>Created from the following versions of the files:</p>
<table>
<tr>
<th>File name</th>
<th>Date stamp</th>
<th>Date type</th>
</tr>
""")

for file in sorted(versions):
    f.write("""<tr><td><a href="public/%s">%s</a></td><td>%s</td><td>%s</td></tr>
""" % (file, file, versions[file][1], versions[file][0]))

f.write("""</table>
</div>
</body>
</html>
""")

f.close()

###############################

g = open(join(HTML_DIR,'committers-by-project.html'), mode='w', encoding='utf-8')

g.write("""<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>ASF Committers by auth group</title>
<link rel="stylesheet" type="text/css" href="css/community.css">
</head>
<body>
<div id="content">
<p>
  This page lists all the LDAP groups and SVN authorization groups found in
  the SVN authorization file and shows the membership of the corresponding groups.
</p>
<p>
<!-- TODO
  Entries in <em>italics</em> do <b>NOT</b> have a signed 
  <a href="http://www.apache.org/licenses/#clas">Contributor License Agreement</a> on file (this knowledge is keyed by SVN id).
  <br>
-->
  Entries in <b>bold</b> are ASF members. 
</p>
<p>
  Please note that the authorisation groups are used to provide access to certain services.
  For example membership of the <a href="#pmc-chairs">pmc-chairs</a> group allows the holder to update
  the Unix and committee LDAP groups.
  However, membership of the pmc-chairs group does not necessarily mean that the holder is currently the chair of a PMC.
  Similarly, membership of the commons-pmc LDAP group does not necessarily imply that the holder is a member of the Commons PMC.
</p>
<p>
  The official documentation for membership of PMCs is the 
  <a href="https://svn.apache.org/repos/private/committers/board/committee-info.txt">committee-info.txt</a> file.
  This requires an ASF login to view.
</p>
<p>
  Membership of the Unix LDAP groups (e.g. tomcat) generally gives write access to SVN.
  Memership of the LDAP committee groups (e.g. tomcat-pmc) generally gives write access to the dist/release area for releasing files.
  The PMC may also have a private area under https://svn.apache.org/repos/private/pmc/{pmc} in which case
  membership of the corresponding LDAP committee group gives both read and write access.
</p>
<p>
  Entries in the "SVN id" column link back to the corresponding entry in the <a href="committer-index.html">Committer Index</a>.
</p>
<p>
  Committers may provide homepage URLs in LDAP.
  <br>
  Login to https://id.apache.org/ and populate the "Homepage URL:" field.
  <br>
  Any such entries are shown as links in the Name column. 
</p>
""")

g.write("<p>Last updated at: %s</p>" % '{:%Y-%m-%d %H:%M UTC}'.format(datetime.datetime.utcnow()))

g.write("""
<hr size="1" noshade>
<!--bodyContent-->
<table border="0">
""")

PER_LINE = 5
count = 0
for group in sorted(groupData):
    if count % PER_LINE == 0:
        g.write("<tr>")
    count += 1
    g.write("""<td><a href="#%s">%s</a></td>""" % (group, podlingName(group)))
    if count % PER_LINE == 0:
        g.write("</tr>\n")
needTr = False
while count % PER_LINE != 0:
    g.write("<td>&nbsp;</td>")
    needTr = True
    count += 1
if needTr:
    g.write("</tr>\n")
g.write("""</table>
<hr size="1" noshade>\n""")   

for group in sorted(groupData):
    g.write("""<h2 id="%s">%s</h2>\n""" % (group, podlingName(group)))
    g.write("""<table><tr><th>SVN id</th><th>Name</th></tr>\n""")
    for id in groupData[group]:
        # SVN id
        g.write("""<tr><td id='%s'><a href="committer-index.html#%s">%s</td>""" % (id, id, idStyle(id, id)))
        # Name
        g.write("<td>%s</td></tr>\n" % idStyle(id, publicName(id)))
    g.write("""</table>\n""")

# trailer
g.write("""
<hr/>
<p>Created from the following versions of the files:</p>
<table>
<tr>
<th>File name</th>
<th>Date stamp</th>
<th>Date type</th>
</tr>
""")

for file in sorted(versions):
    g.write("""<tr><td><a href="public/%s">%s</a></td><td>%s</td><td>%s</td></tr>
""" % (file, file, versions[file][1], versions[file][0]))

g.write("""</table>
</div>
</body>
</html>
""")

g.close()
