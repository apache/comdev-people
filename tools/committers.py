import sys
if sys.hexversion < 0x030000F0:
    raise RuntimeError("This script requires Python3")

"""
Generates html/committer-index.html 
from json files under html/public

Expected usage in cron job:

python3 /var/www/tools/committers.py

"""

from os.path import dirname, abspath, join
from inspect import getsourcefile
import json

MYHOME = dirname(abspath(getsourcefile(lambda:0))) # automatically work out home location
HTML_DIR=join(dirname(MYHOME),'html')
JSON_DIR=join(HTML_DIR,'public')

def getJson(file):
    with open(join(JSON_DIR, file), "r", encoding='utf-8') as f:
        return json.loads(f.read())

members = getJson('member-info.json')['members']
ldap_people = getJson('public_ldap_people.json')['people']

ldap_groups = getJson('public_ldap_groups.json')['groups']
ldap_cttees = getJson('public_ldap_committees.json')['committees']
ldap_services = getJson('public_ldap_services.json')['services']
nonldap_groups = getJson('public_nonldap_groups.json')['groups']
icla_info = getJson('icla-info.json')['committers']

idData = {} # hash of ids; entries are group type and name

for group in ldap_groups:
    if group == 'committers':
        continue
    for id in ldap_groups[group]['roster']:
        try:
            idData[id].append(['unix', group])
        except KeyError:
            idData[id] = [['unix', group]]

for group in ldap_services:
    for id in ldap_services[group]['roster']:
        try:
            idData[id].append(['service', group])
        except KeyError:
            idData[id] = [['service', group]]

for group in nonldap_groups:
    for id in nonldap_groups[group]['roster']:
        try:
            idData[id].append(['other', group])
        except KeyError:
            idData[id] = [['other', group]]

for cttee in ldap_cttees:
    for id in ldap_cttees[cttee]['roster']:
        try:
            idData[id].append(['pmc', cttee])
        except KeyError:
            idData[id] = [['pmc', cttee]]

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
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>ASF Committers by id</title>
<link rel="stylesheet" type="text/css" href="css/community.css">
</head>
<body>
<div id="content">
<p>
      This page lists all known committers by login id.
      For each entry, it shows the full name and any LDAP groups / SVN groups to which they belong.
      This information is derived from LDAP and the SVN authorization file.
</p>
<p>
<!--
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
</p>
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
</div>
</body>
</html>
""")
