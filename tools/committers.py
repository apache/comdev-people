#!/usr/bin/python

"""
Generates:
html/committer-index.html 
html/committers-by-project.html
from json files under html/public

keys/groups/infrastructure-root.asc
from json files under html/public and keys/committer/

Expected usage in cron job:

python3 /var/www/tools/committers.py

"""

import sys
from os.path import dirname, abspath, join, isfile
from inspect import getsourcefile
import datetime
import json

MYHOME = dirname(abspath(getsourcefile(lambda:0))) # automatically work out home location
HTML_DIR=join(dirname(MYHOME),'html')
JSON_DIR=join(HTML_DIR,'public')
KEYS_DIR=join(HTML_DIR,'keys')
KEYS_UID=join(KEYS_DIR,'committer')
KEYS_GRP=join(KEYS_DIR,'group')

versions = {}

def getJson(file, stamp=None):
    with open(join(JSON_DIR, file), "r") as f:
        j = json.loads(f.read(), encoding='utf-8')
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


lastupdate = '{:%Y-%m-%d %H:%M UTC}'.format(datetime.datetime.utcnow())

class _item(object):
    def __init__(self, **kw):
        vars(self).update(kw)


def boldMember(id, txt):
    if isMember(id):
        return "<b>%s</b>" % txt
    return txt

def notICLA(id, txt):
    if not hasICLA(id):
        return "<i>%s</i>" % txt
    return txt

def linkKey(id):
    txt = idStyle(id)
    keyFile = join(KEYS_UID,'%s.asc' % id)
    if isfile(keyFile):
        return """<a href="keys/committer/%s">%s</a>""" % (id, txt)
    return txt

def idStyle(id):
    return notICLA(id, boldMember(id, id))

def nameStyle(id):
    return notICLA(id, boldMember(id, publicName(id)))

# create links to phonebook groups
def linkGroup(groups):
    grp_data = [ ]
    for type, link in sorted(groups, key=lambda group: group[1]+'-'+group[0]):
        name = link
        if type == 'pmc':
            name += '-pmc'
        grp_data.append(_item(type=type, link=link, name=name))

    return grp_data


letter='' # Alpha index
roster = [ ]
# iterate over committers (should be sorted already)
for id in ldap_groups['committers']['roster']:
    person = _item(id=id, name=nameStyle(id).encode('utf-8'), linkkey=linkKey(id),
                   letter=None, groups=None)
    ID1 = id[0:1].upper()
    if not ID1 == letter: # new first letter
        person.letter = ID1
        letter = ID1
    if id in idData:
        person.groups = linkGroup(idData[id])

    roster.append(person)

vsn_data = [_item(file=file,
                  type=versions[file][0],
                  stamp=versions[file][1]) for file in sorted(versions)]

import ezt
template = ezt.Template(join(MYHOME, 'committer-index.ezt'), compress_whitespace=0)
template.generate(open(join(HTML_DIR,'committer-index.html'), mode='w'),
                  { 'lastupdate': lastupdate,
                    'versions': vsn_data,
                    'roster': roster,
                    })


###############################

g = open(join(HTML_DIR,'committers-by-project.html'), mode='w')

g.write("""<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>ASF Committers by auth group</title>
<link rel="stylesheet" type="text/css" href="css/community.css">
<style>
.left, .right {
    background-color: #FFFFFF;
    vertical-align: top;
}
</style>
</head>
<body>
<div id="content">
<h1><img src='img/asf_logo_small.png' alt='Apache feather logo with text' style='vertical-align: middle;'/> ASF Committers by auth group</h1>
<p>
  This page lists all LDAP groups and the SVN authorization groups found in
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

# Create the index

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

# create the individual listings
# put the unix and pmc groups side by side to reduce page length

col=0

for group in sorted(groupData):
    if group+'-pmc' in groupData: # are we processing a unix group with a -pmc group?
        col=1
    if col == 1: # start the left column
        g.write("""<table><tr><td class="left">\n""")
    if col == 2:
        g.write("""<td class="right">\n""")
    g.write("""<h2 id="%s">%s</h2>\n""" % (group, podlingName(group)))
    g.write("""<table><tr><th>SVN id</th><th>Name</th></tr>\n""")
    for id in groupData[group]:
        # SVN id
        g.write("""<tr><td id='%s'><a href="committer-index.html#%s">%s</td>""" % (id, id, idStyle(id)))
        # Name
        g.write("<td>%s</td></tr>\n" % nameStyle(id).encode('utf-8'))
    g.write("""</table>\n""")
    if col > 0:
        g.write("""</td>\n""")
    if col == 2:
        g.write("""</tr></table>\n""")
        col = 0
    if col == 1:
        col = 2

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

##############################################################################

SERVICE='infrastructure-root'
infra_root = getJson('public_ldap_services.json')['services'][SERVICE]['roster']
IROOT=join(KEYS_GRP,'%s.asc' % SERVICE)
h = open(IROOT, mode='w')
for root in infra_root:
    try:
        j = open(join(KEYS_UID,'%s.asc' % root), mode='r', encoding='utf-8')
        h.write(j.read())
        j.close()
    except:
        pass
h.close()
