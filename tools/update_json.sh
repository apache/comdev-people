#!/bin/bash

# Script to get updated copies of Whimsy public JSON files

# Can be run from anywhere

function getNewer() {
    wget -N -nv https://whimsy.apache.org/public/$1
}

MYHOME=$(dirname $0)
cd $MYHOME/../html/public


getNewer committee-info.json
getNewer icla-info.json
getNewer member-info.json
getNewer public_ldap_authgroups.json
getNewer public_ldap_groups.json
getNewer public_ldap_people.json
getNewer public_ldap_services.json
getNewer public_ldap_projects.json
