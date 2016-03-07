var pmcs = [] // array of PMC names (excludes non-PMC committees)
var people = {} // public_ldap_people.json
var ldapgroups = {} //  public_ldap_groups.json
var ldapcttees = {} // public_ldap_committees.json
var ldapservices = {} // public_ldap_services.json

var members = {} // copy of member-info.json
var committees = {} // copy of committee-info.json (plus details for 'member' dummy PMC)
var iclainfo = {} // copy of icla-info.json (committers only)
var nonldapgroups = {} //  public_nonldap_groups.json
var podlings = {} // public_nonldap_groups.json where podling is true

var info = {} // copies of json info

// Constants for query types. 
// Do NOT change the values once established, as they are part of the public API
// For example they may be used in projects.a.o and reporter.a.o
// The values are used for matching HTTP queries and linkifying lists (to generate a valid HTML link)

var Q_USER    = 'user' // search users
var Q_PROJECT = 'project' // search PMC names
var Q_UID     = 'uid' // availid, exact match
var Q_PMC     = 'pmc' // PMC, exact match
var Q_UNIX    = 'unix' // LDAP group
var Q_CTTE    = 'ctte' // LDAP group
var Q_SERVICE = 'service' // LDAP group
var Q_OTHER   = 'other' // non-LDAP group
var Q_PODLING = 'podling' // podling (non-LDAP group)

// Not intended for general use; may change at any time
var Q_DEBUG   = 'debug' // print some debug info

// This is faster than parseInt, and it's more obvious why it is being done
function toInt(number) {
    return number | 0 //
}

var fetchCount = 0;
// Fetch an array of URLs, each with their description and own callback plus a final callback
// Used to fetch everything before rendering a page that relies on multiple JSON sources.
function getAsyncJSONArray(urls, finalCallback) {
    var obj = document.getElementById('progress');
    if (fetchCount == 0 ) {
        fetchCount = urls.length;
    }

    if (urls.length > 0) {
        var a = urls.shift();
        var URL = a[0];
        var desc = a[1];
        var cb = a[2];
        var xmlHttp = null;
        if (window.XMLHttpRequest) {
            xmlHttp = new XMLHttpRequest();
        } else {
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }

        if (obj) { obj.innerHTML = "loading file #" + ( fetchCount - urls.length ) + " / " + fetchCount + "<br>" + desc }
        xmlHttp.open("GET", URL, true);
        xmlHttp.send(null);
        xmlHttp.onreadystatechange = function(state) {
            if (xmlHttp.readyState == 4) {
                if (cb) {
                    if (xmlHttp.status == 200) {
                        cb(JSON.parse(xmlHttp.responseText));
                    } else {
                        cb({});
                        alert("Error: '" + xmlHttp.statusText + "' while loading " + URL)
                    }
                }
                getAsyncJSONArray(urls, finalCallback);
            }
        }
    }
    else {
        if (obj) { obj.innerHTML = "building page content..." }
        finalCallback();
    }
}


function getProjects(uid) {
    var cl = []
    for (var i in ldapgroups) {
		// Are we here? and is this not one of those 'non-project' groups?
        if (i !== "committers" && i !== "member" && ldapgroups[i].roster.indexOf(uid) > -1) {
            cl.push(i)
        }
    }
    return cl
}

// Get the roster from a json group

function getRoster(json, uid, notIn) {
    var cl = []
    for (var i in json) {
        if (json[i].roster.indexOf(uid) > -1) {
        	if (typeof notIn === 'undefined') {
                cl.push(i)        		
        	} else {
        		if (notIn.indexOf(i) == -1) {
        			cl.push(i)
        		}
        	}
        }
    }
    return cl
}

function getCommitteeRoles(uid) {
    var pl = []
    var ch = []
    for (var i in committees) {
        // Only list actual PMCs
        if (committees[i].pmc && uid in committees[i].roster) {
            pl.push(i)
        }
        var chair = committees[i].chair // might not be one (eg members)
        if (chair && uid in committees[i].chair) {
            ch.push(i)
        }
    }
    return [pl, ch]
}

function getCommitterName(uid) {
    var noicla = {
        'andrei' : '(Andrei Zmievski)',
        'pcs'    : '(Paul Sutton)',
        'rasmus' : '(Rasmus Lerdorf)'
    }
    var name
    if (uid in people) { // it's possible for a list to contain a uid that is not in people (e.g. andrei in member)
      name = people[uid].name
    }
    if (!name) {
        name = iclainfo[uid]
    }
    if (!name) { // try the backup specials
        name = noicla[uid]
    }
    return name
}

// Linkify list of group names by adding the appropriate ?type= href

function linkifyList(type, names) {
    var text = ''
    var index, len
    names.sort()
    for (i = 0, len = names.length; i < len; ++i) {
        if (i > 0) {
            text = text + ", "
        }
        text = text + "<a href='?"+type+"=" + names[i] + "'>" + names[i] + "</a>"
    }
    return text
}

// Linkify user ids

function userList(ua) {
    var text = ''
    var index, len
    ua.sort()
    for (index = 0, len = ua.length; index < len; ++index) {
        if (index > 0) {
            text = text + ", "
        }
        text = text + hiliteMember(ua[index])
    }
    return text
}

//Linkify URLs

function linkifyURLs(ua) {
    var text = ''
    var index, len
    ua.sort()
    for (index = 0, len = ua.length; index < len; ++index) {
        if (index > 0) {
            text = text + ", "
        }
        text = text + "<a target='_blank' href='"+ ua[index] + "'>" + ua[index] + "</a>"
    }
    return text
}

function showCommitter(obj, uid) {
	var details = document.getElementById('details_committer_' + uid)
	if (!details) {
		details = document.createElement('p')
		details.setAttribute("id", 'details_committer_' + uid)
		var cl = getProjects(uid)
		var roles = getCommitteeRoles(uid)
        var cttees = getRoster(ldapcttees, uid)
        var pl = roles[0]
        var ch = roles[1]
        if (isNologin(uid)) {
            details.innerHTML += "<b>Login is currently disabled</b><br/><br/>"
        }
		if (isMember(uid)) {
			details.innerHTML += "<img src='asfmember.png' style='vertical-align: middle;'/> <i>Foundation member</i><br/><br/>"
		}
        if (ch.length > 0) {
            details.innerHTML += "<b>Chair of:</b> " + linkifyList(Q_PMC, ch) + "<br/><br/>"
        }
        var purls = urls(uid)
        if (purls.length > 0) {
			details.innerHTML += "<b>Personal URLs:</b> " + linkifyURLs(purls) + "<br/><br/>"        	
        }
		if (cl.length > 0) {
			details.innerHTML += "<b>Committer on:</b> " + linkifyList(Q_UNIX, cl) + "<br/><br/>"
		}
		var nc = [] // On PMC but not in LDAP unix
		var nl = [] // On PMC but not in LDAP committee
		var np = [] // Not in PMC even though in LDAP committee
		var nu = [] // In LDAP committee but not in LDAP unix
		if (pl.length > 0) {
			details.innerHTML += "<b>PMC member of:</b> " + linkifyList(Q_PMC, pl) + "<br/><br/>"
			for (p in pl) {
			    pn = pl[p]
			    // Don't check against Unix groups that don't exist
			    if (pn != 'member' && pn in ldapgroups && cl.indexOf(pn) < 0) {
			        nc.push(pn)
			    }
			    if (pn in ldapcttees && cttees.indexOf(pn) < 0) {
                    nl.push(pn)
			    } 
			}
		}

        if (cttees.length > 0) {
            for (p in cttees) {
                pn = cttees[p]
                // name is a PMC but uid is not on the PMC
                if (isPMC(pn) && pl.indexOf(pn) < 0) {
                        np.push(pn)
                }
                if (pn in ldapgroups && cl.indexOf(pn) < 0) {
                    nu.push(pn)
                }
            }
            details.innerHTML += "<b>LDAP committee group membership:</b> " + linkifyList(Q_CTTE, cttees) + "<br/><br/>"
        }

        var services = getRoster(ldapservices, uid)
        if (services.length > 0) {
            details.innerHTML += "<b>Service group membership:</b> " + linkifyList(Q_SERVICE, services) + "<br/><br/>"
        }
        var pods = getRoster(podlings, uid)
        if (pods.length > 0) {
            details.innerHTML += "<b>Podling membership:</b> " + linkifyList(Q_PODLING, pods) + "<br/><br/>"
        }

        var others = getRoster(nonldapgroups, uid, pods)
        if (others.length > 0) {
            details.innerHTML += "<b>Other group membership:</b> " + linkifyList(Q_OTHER, others) + "<br/><br/>"
        }

        // Note any discrepancies
        if (np.length > 0) {
            details.innerHTML += "<span class='error'>In LDAP committee group, but <b>not a PMC member</b>:</span> " + linkifyList(Q_CTTE, np) + "<br/><br/>"
        }
        if (nc.length > 0) {
            details.innerHTML += "<span class='error'>On PMC, but not a member of the committer group:</span> " + linkifyList(Q_PMC, nc) + "<br/><br/>"
        }
        if (nl.length > 0) {
            details.innerHTML += "<span class='error'>On PMC, but not member of the LDAP committee group:</span> " + linkifyList(Q_CTTE, nl) + "<br/><br/>"
        }
        if (nu.length > 0) {
            details.innerHTML += "<span class='error'>In LDAP committee group but not a member of the committer(unix) group:</span> " + linkifyList(Q_UNIX, nu) + "<br/><br/>"
        }
		obj.appendChild(details)
	} else {
		obj.removeChild(details)
	}
}

function hoverCommitter(parent, uid) {
    var div = document.getElementById('hoverbar')
    
    // If the datepicker object doesn't exist, spawn it
    if (!div) {
        div = document.createElement('div')
		document.body.appendChild(div)
        div.setAttribute("id", "hoverbar")
        div.style.position = "fixed"
		div.style.width = "400px"
		div.style.background = "linear-gradient(to bottom, rgba(254,255,232,1) 0%,rgba(214,219,191,1) 100%)"
		div.style.borderRadius = "4px"
		div.style.border = "1px solid #333"
		div.style.zIndex = "9999"
    }
    
    // Reset the contents of the datepicker object
    div.innerHTML = ""
    
	var bb = parent.getBoundingClientRect()
    div.style.top = (bb.bottom + 24) + "px"
    div.style.left = (bb.left + 32) + "px"
	
	if (uid) {
		div.style.display = "block"
		div.innerHTML = "<h4>" + getCommitterName(uid) + "</h4>"
		var cl = getProjects(uid)
        var roles = getCommitteeRoles(uid)
        var pl = roles[0]
        var ch = roles[1]
		if (isMember(uid) == true) {
			div.innerHTML += "<img src='asfmember.png' style='vertical-align: middle;'/> <i>Foundation member</i><br/><br/>"
		}
        if (isNologin(uid)) {
            div.innerHTML += "<b>Login is currently disabled</b><br/><br/>"
        }
        if (ch.length > 0) {
            ch.sort()
            div.innerHTML += "<b>Chair of:</b> " + ch.join(", ") + "<br/><br/>"
        }
		if (cl.length > 0) {
		    cl.sort()
			div.innerHTML += "<b>Committer on:</b> " + cl.join(", ") + "<br/><br/>"
		}
        var nc = []
		if (pl.length > 0) {
		    pl.sort()
			div.innerHTML += "<b>PMC member of:</b> " + pl.join(", ") + "<br/><br/>"
            for (p in pl) {
                pn = pl[p]
                if (pn != 'member' && cl.indexOf(pn) < 0) {
                    nc.push(pn)
                }
            }
		}
        if (nc.length > 0) {
            div.innerHTML += "<i>On PMC, but not a Committer on:</i> " + nc.join(", ") + "<br/><br/>"
        }


	} else {
		div.style.display = "none"
	}
}

function isNologin(uid) {
    return !(uid in people) || people[uid].noLogin
}

function isMember(uid) {
    return members['members'].indexOf(uid) > -1
}

function urls(uid) {
	return people[uid].urls || []
}

function isPMC(name) {
    return pmcs.indexOf(name) >= 0;
}

function linkifyUid(uid) {
    if (isNologin(uid)) {
        return "<del><a href='?uid="+ uid+ "'>" + uid + "</a></del>"
    }
    return "<a href='?uid="+ uid+ "'>" + uid + "</a>"
}

function hiliteMember(uid) {
    if (isMember(uid)) {
        return "<b>" + linkifyUid(uid) + "</b>"
    } else {
        return linkifyUid(uid)
    }
}

function getChair(uid) {
    var chair = committees[uid].chair
    if (chair) {
        for (var x in chair) {
            return chair[x].name
        }
    }
    return null
}

function showProject(obj, prj) {
	var details = document.getElementById('details_project_' + prj)
	if (!details) {
		details = document.createElement('p')
		details.setAttribute("id", 'details_project_' + prj)
		var desc = committees[prj].description
		if (!desc) {
            desc = 'TBA (please ensure that <a href="http://www.apache.org/index.html#projects-list">the projects list</a> is updated)'
		}
		var chair = getChair(prj)
		if (chair) {
            details.innerHTML += "<b>Chair:</b> " + chair + "<br/><br/>"
        }
        var url = committees[prj].site
        if (url) {
            details.innerHTML += "<a href='"+url+"' target='_blank'><b>Description:</b></a><br/><br/>" + desc + "<br/><br/>"
        } else {
            details.innerHTML += "<b>Description:</b><br/><br/>" + desc + "<br/><br/>"
        }
		var cl
		try { 
		  cl = ldapgroups[prj].roster.slice()
	    } catch(err) { // Allow for broken json generated by people.lua (INFRA-10888)
	      cl = []
	    }
		var pl = []
		var pmc = committees[prj]

		var pmcnoctte = [] // on pmc but not in LDAP committee
        var cttenopmc = [] // In LDAP ctte but not on PMC
		var ldappmc = []
		if (prj != 'member') { // does not exist for 'member' PMC
		    ldappmc = ldapcttees[prj].roster
		}
		var pmcnounix = [] // on PMC but not in LDAP unix group
		var cttenounix = [] // In LDAP ctte but not in LDAP unix
		if (pmc) {
            for(var c in pmc.roster) {
              pl.push(c)
            }
            for (var i in ldappmc) {
                if (!(ldappmc[i] in pmc.roster)) {
                    cttenopmc.push(ldappmc[i])
                }
            }
		}
		cl.sort()
		pl.sort()

        // Must use cl before it is re-used to hold the entries
        if (prj != 'member') { // does not exist for 'member' PMC
          for (var i in ldappmc) {
            var id = ldappmc[i]
            if (cl.indexOf(id) < 0) { // in LDAP cttee but not in LDAP unix
                cttenounix.push(id)
            }
          }
        }

		for (var i in pl) {
		    var id = pl[i]
            pl[i] = "<li onmouseover='hoverCommitter(this, \"" + pl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(pl[i]) + "</kbd> - " + getCommitterName(pl[i]) + "</li>"
		    if (cl.indexOf(id) < 0) { // On PMC but not in LDAP unix group
                pmcnounix.push(id)
		    }
            if (prj != 'member' && ldappmc && ldappmc.indexOf(id) < 0) { // in PMC but not in LDAP committee (does not apply to member)
                pmcnoctte.push(id)
            }
		}
		
        for (var i in cl) {
            cl[i] = "<li onmouseover='hoverCommitter(this, \"" + cl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(cl[i]) + "</kbd> - " + getCommitterName(cl[i]) + "</li>"
        }

		if (pl.length > 0) {
			details.innerHTML += "<b>PMC members (also in the <a href='?ctte="+prj+"'>committee group</a>"+ " unless noted below):</b> <ul>" + pl.join("\n") + "</ul><br/>"
		}
		
		if (cl && cl.length > 0) {
			details.innerHTML += "<b>Committers:</b> <ul>" + cl.join("\n") + "</ul><br/>"
		}

        if (pmcnoctte.length) {
            details.innerHTML += "<span class='error'>PMC members not in LDAP committee group:</span> " + userList(pmcnoctte) + "<br/><br/>"
        }
        if (pmcnounix.length) {
            details.innerHTML += "<span class='error'>PMC members not in committers(unix) group:</span> " + userList(pmcnounix) + "<br/><br/>"
        }
        if (cttenounix.length) {
            details.innerHTML += "<span class='error'>LDAP committee group members not in committers(unix) group:</span> " + userList(cttenounix) + "<br/><br/>"
        }
        if (cttenopmc.length) {
            details.innerHTML += "<span class='error'>LDAP committee group members not on PMC:</span> " + userList(cttenopmc) + "<br/><br/>"
        }

		
		obj.appendChild(details)
	} else {
		obj.removeChild(details)
	}
}

// Generic group display function

function showJsonRoster(obj, type, json, name) {
    var id = 'details_' + type + '_' + name
    var details = document.getElementById(id)
    if (!details) {
        details = document.createElement('p')
        details.setAttribute("id", id)
        var podtype = json[name]['podling']
        if (podtype) {
        	details.innerHTML += "<b>podling:</b> " + podtype + "<br><br>" 
        }
        var cl = json[name].roster.slice()
        cl.sort()
        for (var i in cl) {
            cl[i] = "<li onmouseover='hoverCommitter(this, \"" + cl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(cl[i]) + "</kbd> - " + getCommitterName(cl[i]) + "</li>"
        }

        if (cl && cl.length > 0) {
            details.innerHTML += "<b>Roster:</b> <ul>" + cl.join("\n") + "</ul><br/>"
        }
        obj.appendChild(details)
    } else {
        obj.removeChild(details)
    }
}

// Show a single Service group
function showServiceRoster(obj, name) {
    showJsonRoster(obj, 'service', ldapservices, name)
}

// Show a single Other group
function showOtherRoster(obj, name) {
    showJsonRoster(obj, 'other', nonldapgroups, name)
}

function showPodlingRoster(obj, name) {
    showJsonRoster(obj, 'podling', podlings, name)
}

// Show an LDAP Unix group

function showGroup(obj, name) {
    showJsonRoster(obj, 'group', ldapgroups, name)
}

// Show an LDAP Commiteee group

function showCommittee(obj, name) {
    showJsonRoster(obj, 'ctte', ldapcttees, name)
    return
}

function searchProjects(keyword, open) {
	var obj = document.getElementById('phonebook')
	if (keyword != '') {
	   obj.innerHTML = "<h3>Search results:</h3><hr/>"
	} else {
	   obj.innerHTML = ''
	}
	for (var i in pmcs) {
		var pmc = pmcs[i]
		if (pmc.search(keyword.toLowerCase()) != -1) {
			var ppmc = committees[pmc].display_name
			obj.innerHTML += "<div id='project_" + pmc + "' class='group'><h3 onclick=\"showProject(this.parentNode, '" + pmc + "');\">Apache " + ppmc + "</h3></div>"
			if (open) {
				showProject(document.getElementById('project_' + pmc), pmc)
			}
		}
	}
}

// Show a single PMC

function showPMC(pmc) {
    var obj = document.getElementById('phonebook')
    if (pmc in committees) {
        var ppmc = committees[pmc].display_name
        obj.innerHTML = "<div id='project_" + pmc + "' class='group'><h3 onclick=\"showProject(this.parentNode, '" + pmc + "');\">Apache " + ppmc + "</h3></div>"
        showProject(document.getElementById('project_' + pmc), pmc)
    } else {
        obj.innerHTML = "<h3>Could not find PMC: '"+ pmc +"'</h3>"
    }
}

// Show a single Unix Group

function showUNIX(unix) {
    var obj = document.getElementById('phonebook')
    var id = 'group_' + unix
    if (unix in ldapgroups) {
        obj.innerHTML = "<div id='" + id + "' class='group'><h3 onclick=\"showGroup(this.parentNode, '" + unix + "');\">" + unix + " (LDAP unix group)</h3></div>"
        showGroup(document.getElementById(id), unix)
    } else {
        obj.innerHTML = "<h3>Could not find unix group: '"+ unix +"'</h3>"
    }
}

// Show a single Committee group

function showCTTE(ctte) {
    var obj = document.getElementById('phonebook')
    var id = 'ctte_' + ctte
    if (ctte in ldapcttees) {
        obj.innerHTML = "<div id='" + id + "' class='group'><h3 onclick=\"showCommitte(this.parentNode, '" + ctte + "');\">" + ctte + " (LDAP committee group)</h3></div>"
        showCommittee(document.getElementById(id), ctte)
    } else {
        obj.innerHTML = "<h3>Could not find committee group: '"+ ctte +"'</h3>"
    }
}

function showSVC(name) {
    var obj = document.getElementById('phonebook')
    var id = 'service_' + name
    if (name in ldapservices) {
        obj.innerHTML = "<div id='" + id + "' class='group'><h3 onclick=\"showServiceRoster(this.parentNode, '" + name + "');\">" + name + " (LDAP service group)</h3></div>"
        showServiceRoster(document.getElementById(id), name)
    } else {
        obj.innerHTML = "<h3>Could not find the service group: '"+ name +"'</h3>"
    }
}

function showOTH(name) {
    var obj = document.getElementById('phonebook')
    var id = 'other_' + name
    if (name in nonldapgroups) {
        obj.innerHTML = "<div id='" + id + "' class='group'><h3 onclick=\"showOtherRoster(this.parentNode, '" + name + "');\">" + name + " (non-LDAP group)</h3></div>"
        showOtherRoster(document.getElementById(id), name)
    } else {
        obj.innerHTML = "<h3>Could not find the non-LDAP group: '"+ name +"'</h3>"
    }
}

function showPOD(name) {
    var obj = document.getElementById('phonebook')
    var id = 'podling_' + name
    if (name in podlings) {
        obj.innerHTML = "<div id='" + id + "' class='group'><h3 onclick=\"showPodlingRoster(this.parentNode, '" + name + "');\">" + name + " (podling)</h3></div>"
        showPodlingRoster(document.getElementById(id), name)
    } else {
        obj.innerHTML = "<h3>Could not find the podling: '"+ name +"'</h3>"
    }
}

function searchPodlings(keyword, open) {
	var obj = document.getElementById('phonebook')
    obj.innerHTML = "<h3>Search results:</h3><hr/>"
	for (var name in podlings) {
		if (name.search(keyword.toLowerCase()) != -1) {
		    var id = 'podling_' + name
	        obj.innerHTML += "<div id='" + id + "' class='group'><h3 onclick=\"showPodlingRoster(this.parentNode, '" + name + "');\">" + name + " (podling)</h3></div>"
		}			
	}
}

function showDBG(name) {
    var obj = document.getElementById('phonebook')
    if (name == 'info') {
        obj.innerHTML = "<h3>info</h3>"
    	obj.innerHTML += "<pre>" + JSON.stringify(info, null, 1) + "</pre>"
    	
    } else {
        obj.innerHTML = "<h3>Unknown debug name: '"+ name +"'</h3>"
    }
}

// Show a single User

function showUid(uid) {
    var obj = document.getElementById('phonebook')
    if (uid in people) {
        var name = getCommitterName(uid)
        obj.innerHTML = "<div class='group' id='committer_" + uid + "'><h4 onclick=\"showCommitter(this.parentNode, '" + uid + "');\">" + name + " (<kbd>" + uid + "</kbd>)</h4></div>"
        showCommitter(document.getElementById('committer_' + uid), uid)
    } else {
        obj.innerHTML = "<h3>Could not find user id: '"+ uid +"'</h3>"
    }
}

function showError(error) {
    var obj = document.getElementById('phonebook')
    if (typeof(error) === 'string') {
        obj.innerHTML = "<h3>Error detected</h3>"
        obj.innerHTML += error
    } else { // assume it's an error object
        obj.innerHTML = "<h3>Javascript Error detected</h3>"
        obj.innerHTML += "<hr/>"
        obj.innerHTML += "<pre>"+ error.message + "</pre>"
        obj.innerHTML += "<pre>"+ error.stack + "</pre>"
        obj.innerHTML += "<hr/>"
    }
}

function searchCommitters(keyword, open) {
	if (keyword.length < 2) {
		return
	}
	var n = 0
	var obj = document.getElementById('phonebook')
	obj.innerHTML = "<h3>Search results:</h3><hr/>"
	for (var uid in people) {
	  if (!people[uid].noLogin) { // don't display disabled logins
		var name = getCommitterName(uid)
		if (uid.search(keyword.toLowerCase()) != -1 || name.toLowerCase().search(keyword.toLowerCase()) != -1) {
			n++
			if (n > 50) {
				return;
			}
			obj.innerHTML += "<div class='group' id='committer_" + uid + "'><h4 onclick=\"showCommitter(this.parentNode, '" + uid + "');\">" + name 
			+ " (<kbd>" + uid + "</kbd>) <a title='Link to committer details' href='phonebook.html?uid="+uid+"'>&#149</a></h4></div>"
			if (open) {
				showCommitter(document.getElementById('committer_' + uid), uid)
			}
		}
	  }
	}
}

function saveInfo(json,name) {
	info[name] = {}
	info[name]['lastTimestamp'] = json.lastTimestamp
}

function preRender() {
    getAsyncJSONArray([
        ['https://whimsy.apache.org/public/member-info.json',            "members",    function(json) { members = json; }],
        ["https://whimsy.apache.org/public/public_ldap_people.json",     "people",     function(json) { people = json.people;  saveInfo(json,'people');}],
        ['https://whimsy.apache.org/public/committee-info.json',         "committees", function(json) { committees = json.committees; }],
        ['https://whimsy.apache.org/public/icla-info.json',              "iclainfo",   function(json) { iclainfo = json.committers; }],
        ['https://whimsy.apache.org/public/public_ldap_groups.json',     "ldapgroups", function(json) { ldapgroups = json.groups; saveInfo(json,'ldapgroups'); }],
        ['https://whimsy.apache.org/public/public_ldap_committees.json', "ldapcttees", function(json) { ldapcttees = json.committees; saveInfo(json,'ldapcttees'); }],
        ['https://whimsy.apache.org/public/public_ldap_services.json',   "services",   function(json) { ldapservices = json.services; saveInfo(json,'ldapservices'); }],
        ['https://whimsy.apache.org/public/public_nonldap_groups.json',  "nonldapgroups", function(json) { 
        	nonldapgroups = json.groups;
        	for (var g in nonldapgroups) {
        		if (nonldapgroups[g]['podling']) {
        			podlings[g] = nonldapgroups[g]
        		}
        	}
        	}],
        ],
        allDone);
}

// Called when all the async GETs have been completed

function allDone() {
  try {
	pmcs = []
	for (var k in committees) { // actual committees, not LDAP committee groups
	    if (committees[k].pmc) { // skip non-PMCs
            pmcs.push(k)
        }
	}
	pmcs.push('member')
	pmcs.sort()
	var mMap = {}
	for (var m in members.members) {
	    mMap[members.members[m]] = {}
	}
    // copy across the members info
	committees['member'] = {
	    'roster': mMap,
        'display_name': 'Foundation Members',
        'description': "ASF membership (PMC members == current members, Committers == those with member karma)",
        'site': 'http://www.apache.org/foundation/'
        }

    // Match ?type=name
    var match = document.location.search.match(/^\?(\w+)=(.+)/)
    if (match) {
        var type = match[1]
        var name = match[2]
        if (type == Q_USER) {
            searchCommitters(name, true)
        } else if (type == Q_PROJECT) {
            searchProjects(name, true)
        } else if (type == Q_UID) {
            showUid(name)
        } else if (type == Q_PMC) {
            showPMC(name)
        } else if (type == Q_UNIX) {
            showUNIX(name)
        } else if (type == Q_CTTE) {
            showCTTE(name)
        } else if (type == Q_SERVICE) {
            showSVC(name)
        } else if (type == Q_OTHER) {
            showOTH(name)
        } else if (type == Q_PODLING) {
            showPOD(name)
        } else if (type == Q_DEBUG) {
            showDBG(name)
        } else {
            showError("Unexpected query: " + type)
        }
    } else {
	    searchProjects("")
	}
  } catch (error) {
    showError(error)
  }
}


