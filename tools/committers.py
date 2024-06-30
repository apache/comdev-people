#!/usr/bin/python3

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

import ezt


MYHOME = dirname(abspath(getsourcefile(lambda:0))) # automatically work out home location
HTML_DIR=join(dirname(MYHOME),'html')
JSON_DIR=join(HTML_DIR,'public')
KEYS_DIR=join(HTML_DIR,'keys')
KEYS_UID=join(KEYS_DIR,'committer')
KEYS_GRP=join(KEYS_DIR,'group')

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

ldap_groups = getJson('public_ldap_groups.json', 'lastTimestamp')['groups'] # only used for apsite, members, committers
ldap_services = getJson('public_ldap_services.json', 'lastTimestamp')['services']
icla_info = getJson('icla-info.json', 'last_updated')['committers']
projects = getJson('public_ldap_projects.json', 'lastTimestamp')['projects']

idData = {} # hash of ids; entries are group type and name
groupData = {} # hash of group names; entries are lists of committer ids

for prj in projects:
    project = projects[prj]
    if 'pmc' in project and project['pmc'] == True:
        gname=prj
        groupData[gname] = []
        for id in project['members']:
            groupData[gname].append(id)
            try:
                idData[id].append(['unix', prj])
            except KeyError:
                idData[id] = [['unix', prj]]

        gname=prj+'-pmc'
        groupData[gname] = []
        for id in project['owners']:
            groupData[gname].append(id)
            try:
                idData[id].append(['pmc', prj])
            except KeyError:
                idData[id] = [['pmc', prj]]
    elif 'podling' in project and project['podling'] == 'current':
        groupData[prj] = []
        # Assume owners is subset of members
        for id in project['members']:
            groupData[prj].append(id)
            try:
                idData[id].append(['podling', prj])
            except KeyError:
                idData[id] = [['podling', prj]]

# Allow for non-project groups (apsite, member)
for group in ldap_groups:
    # don't overwrite existing groups
    if group in groupData:
        continue
    # Only pick up these groups
    if not group in ['apsite', 'member']:
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

def podlingName(group):
    if group in projects and 'podling' in projects[group] and not 'pmc' in projects[group]:
        status = projects[group]['podling']
        if status == 'current':
            status = "incubating"
        return group + " (" + status + ")"
    else:
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
    for type, link in sorted(groups, key=lambda x: x[1]+'-'+x[0]):
        name = link
        if type == 'pmc':
            name += '-pmc'
        grp_data.append(_item(type=type, link=link, name=name))

    return grp_data


letter='' # Alpha index
roster = [ ]
# iterate over committers (should be sorted already)
for id in ldap_groups['committers']['roster']:
    person = _item(id=id, name=nameStyle(id), linkkey=linkKey(id),
                   is_member=ezt.boolean(isMember(id)),
                   has_icla=ezt.boolean(hasICLA(id)),
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

template = ezt.Template(join(MYHOME, 'committer-index.ezt'), compress_whitespace=0)
template.generate(open(join(HTML_DIR,'committer-index.html'), mode='w'),
                  { 'lastupdate': lastupdate,
                    'versions': vsn_data,
                    'roster': roster,
                    })


###############################

from io import StringIO
g = StringIO()


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
        g.write("<td>%s</td></tr>\n" % nameStyle(id))
    g.write("""</table>\n""")
    if col > 0:
        g.write("""</td>\n""")
    if col == 2:
        g.write("""</tr></table>\n""")
        col = 0
    if col == 1:
        col = 2

content = g.getvalue()


template = ezt.Template(join(MYHOME, 'committers-by-project.ezt'),
                        compress_whitespace=0)
template.generate(open(join(HTML_DIR,'committers-by-project.html'), mode='w'),
                  { 'lastupdate': lastupdate,
                    'versions': vsn_data,
                    'content': content,
                    })


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
