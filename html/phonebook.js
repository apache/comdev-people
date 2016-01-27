var pmcs = [] // array of PMC names (excludes non-PMC committees)
var people = {} // public_ldap_people.json
var ldapgroups = {} //  public_ldap_groups.json
var ldapcttees = {} // public_ldap_committees.json

var members = {} // copy of member-info.json
var committees = {} // copy of committee-info.json (plus details for 'member' dummy PMC)
var iclainfo = {} // copy of icla-info.json

var asyncCalls = 0 // number of async GETs to wait for

function getAsyncJSON(theUrl, xstate, callback) {
	var xmlHttp = null;
	if (window.XMLHttpRequest) {
		xmlHttp = new XMLHttpRequest();
	} else {
		xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
	}
	xmlHttp.open("GET", theUrl, true);
	xmlHttp.send(null);
	xmlHttp.onprogress = function(state) {
		if (document.getElementById('pct')) {
			var s = parseInt(xmlHttp.getResponseHeader('Content-Length')) // not allowed with CORS
			document.getElementById('pct').innerHTML = "<p style='text-align: center;'><b><i>Loading: " + parseInt((100 * (xmlHttp.responseText.length / s))) + "% done</i></b></p>";
		}
	}
	xmlHttp.onreadystatechange = function(state) {

		if (xmlHttp.readyState == 4 && xmlHttp.status == 200 || xmlHttp.status == 404) {
			if (callback) {
				if (xmlHttp.status == 404) {
					callback({}, xstate);
				} else {
					if (document.getElementById('pct')) {
						document.getElementById('pct').innerHTML = "<p style='text-align: center;'><b><i>Loading: 100% done</i></b></p>";
					}
					window.setTimeout(callback, 0.05, JSON.parse(xmlHttp.responseText), xstate);
				}
			}
		}
	}
}

function getProjects(uid) {
    var cl = []
    for (var i in ldapgroups) {
        if (ldapgroups[i].roster.indexOf(uid) > -1) {
            cl.push(i)
        }
    }
    return cl
}

function getCommitteeRoles(uid) {
    var pl = []
    var ch = []
    for (var i in committees.committees) {
        if (uid in committees.committees[i].roster) {
            pl.push(i)
        }
        var chair = committees.committees[i].chair // might not be one (eg members)
        if (chair && uid in committees.committees[i].chair) {
            ch.push(i)
        }
    }
    return [pl, ch]
}

function getCommitterName(uid) {
    var name = people[uid].name
    if (!name) {
        name = iclainfo.committers[uid]
    }
    return name
}

// Linkify PMC names
function projectList(pa) {
    var text = ''
    var index, len
    for (index = 0, len = pa.length; index < len; ++index) {
        if (index > 0) {
            text = text + ", "
        }
        text = text + "<a href='?pmc=" + pa[index] + "'>" + pa[index] + "</a>"
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
        var pl = roles[0]
        var ch = roles[1]
        if (isNologin(uid)) {
            details.innerHTML += "<b>Login is currently disabled</b><br/><br/>"
        }
		if (isMember(uid)) {
			details.innerHTML += "<img src='asfmember.png' style='vertical-align: middle;'/> <i>Foundation member</i><br/><br/>"
		}
        if (ch.length > 0) {
            details.innerHTML += "<b>Chair of:</b> " + projectList(ch) + "<br/><br/>"
        }
		if (cl.length > 0) {
			details.innerHTML += "<b>Committer on:</b> " + projectList(cl) + "<br/><br/>"
		}
		if (pl.length > 0) {
			details.innerHTML += "<b>PMC member of:</b> " + projectList(pl) + "<br/><br/>"
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
        var id = parseInt(Math.random() * 10000).toString(16)
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
        if (ch.length > 0) {
            div.innerHTML += "<b>Chair of:</b> " + ch.join(", ") + "<br/><br/>"
        }
		if (cl.length > 0) {
			div.innerHTML += "<b>Committer on:</b> " + cl.join(", ") + "<br/><br/>"
		}
		if (pl.length > 0) {
			div.innerHTML += "<b>PMC member of:</b> " + pl.join(", ") + "<br/><br/>"
		}
	} else {
		div.style.display = "none"
	}
}

function isNologin(uid) {
    return people[uid].noLogin
}

function isMember(uid) {
    return members['members'].indexOf(uid) > -1
}

function linkifyUid(uid) {
    return "<a href='?uid="+ uid+ "'>" + uid +"</a>"
}

function hiliteMember(uid) {
    if (isMember(uid)) {
        return "<b>" + linkifyUid(uid) + "</b>"
    } else {
        return linkifyUid(uid)
    }
}

function getChair(uid) {
    var chair = committees.committees[uid].chair
    if (chair) {
        for (var x in chair) {
            return chair[x].name
        }
    }
    return null
}

function showProject(obj, uid) {
	var details = document.getElementById('details_project_' + uid)
	if (!details) {
		details = document.createElement('p')
		details.setAttribute("id", 'details_project_' + uid)
		var desc = committees.committees[uid].description
		if (!desc) {
            desc = 'TBA (please ensure that <a href="http://www.apache.org/index.html#projects-list">the projects list</a> is updated)'
		}
		var chair = getChair(uid)
		if (chair) {
            details.innerHTML += "<b>Chair:</b> " + chair + "<br/><br/>"
        }
        var url = committees.committees[uid].site
        if (url) {
            details.innerHTML += "<a href='"+url+"' target='_blank'><b>Description:</b></a><br/><br/>" + desc + "<br/><br/>"
        } else {
            details.innerHTML += "<b>Description:</b><br/><br/>" + desc + "<br/><br/>"
        }
		var cl
		try { 
		  cl = ldapgroups[uid].roster.slice()
	    } catch(err) { // Allow for broken json generated by people.lua (INFRA-10888)
	      cl = []
	    }
		var pl = []
		var pmc = committees.committees[uid]

		var pmcnoctte = [] // on pmc but not in LDAP committee
		var ldappmc = ldapcttees[uid].roster // array
		var pmcnounix = [] // on PMC but not in LDAP unix group
		var cttenounix = [] // In LDAP ctte but not in LDAP unix
		if (pmc) {
            for(var c in pmc.roster) {
              pl.push(c)
            }
		}
		cl.sort()
		pl.sort()

        // Must use cl before it is re-used to hold the entries
        for (var i in ldappmc) {
            var id = pl[i]
            if (cl.indexOf(id) < 0) { // in LDAP cttee but not in LDAP unix
                cttenounix.push(id)
            }
        }

		for (var i in pl) {
		    var id = pl[i]
            pl[i] = "<li onmouseover='hoverCommitter(this, \"" + pl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(pl[i]) + "</kbd> - " + getCommitterName(pl[i]) + "</li>"
		    if (cl.indexOf(id) < 0) { // On PMC but not in LDAP unix group
                pmcnounix.push(id)
		    }
            if (ldappmc && ldappmc.indexOf(id) < 0) { // in PMC but not in LDAP committee
                pmcnoctte.push(id)
            }
		}
		
        for (var i in cl) {
            cl[i] = "<li onmouseover='hoverCommitter(this, \"" + cl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(cl[i]) + "</kbd> - " + getCommitterName(cl[i]) + "</li>"
        }

		if (pl.length > 0) {
			details.innerHTML += "<b>PMC members:</b> <ul>" + pl.join("\n") + "</ul><br/>"
		}
		
		if (cl && cl.length > 0) {
			details.innerHTML += "<b>Committers:</b> <ul>" + cl.join("\n") + "</ul><br/>"
		}

        var errors = cttenounix.length + pmcnounix.length + pmcnoctte.length
        if (errors > 0) {
            if (pmcnoctte.length) {
                details.innerHTML += "<span class='error'>PMC members not in LDAP committee group:</span> " + pmcnoctte.join(',') + "<br/><br/>"
            }
            if (pmcnounix.length) {
                details.innerHTML += "<span class='error'>PMC members not in committers(unix) group:</span> " + pmcnounix.join(',') + "<br/><br/>"
            }
            if (cttenounix.length) {
                details.innerHTML += "<span class='error'>LDAP cttee members not in committers(unix) group:</span> " + cttenounix.join(',') + "<br/><br/>"
            }
        }
		
		obj.appendChild(details)
	} else {
		obj.removeChild(details)
	}
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
			var ppmc = committees.committees[pmc].display_name
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
    if (pmc in committees.committees) {
        var ppmc = committees.committees[pmc].display_name
        obj.innerHTML += "<div id='project_" + pmc + "' class='group'><h3 onclick=\"showProject(this.parentNode, '" + pmc + "');\">Apache " + ppmc + "</h3></div>"
        showProject(document.getElementById('project_' + pmc), pmc)
    } else {
        obj.innerHTML = "<h3>Could not find PMC: '"+ pmc +"'</h3>"
    }
}

// Show a single User

function showUid(uid) {
    var obj = document.getElementById('phonebook')
    if (uid in people) {
        var name = getCommitterName(uid)
        obj.innerHTML += "<div class='group' id='committer_" + uid + "'><h4 onclick=\"showCommitter(this.parentNode, '" + uid + "');\">" + name + " (<kbd>" + uid + "</kbd>)</h4></div>"
        showCommitter(document.getElementById('committer_' + uid), uid)
    } else {
        obj.innerHTML = "<h3>Could not find user id: '"+ uid +"'</h3>"
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
			obj.innerHTML += "<div class='group' id='committer_" + uid + "'><h4 onclick=\"showCommitter(this.parentNode, '" + uid + "');\">" + name + " (<kbd>" + uid + "</kbd>)</h4></div>"
			if (open) {
				showCommitter(document.getElementById('committer_' + uid), uid)
			}
		}
	  }
	}
}

function saveData(xjson, xdata) {
    // Copy the json contents
    for (var k in xjson) {
        xdata[k] = xjson[k]
    }
    asyncCalls -= 1
    if (asyncCalls <= 0) {
		// Save the data in localStorage if possible, so we'll have a cache for next visit (if within 1 hour)
		var now = parseInt(new Date().getTime() / (3600*1000))
		if (typeof(window.localStorage) !== "undefined") {
			var new_data = new Array()
			new_data[0] = members
			new_data[1] = committees
			new_data[2] = iclainfo
			new_data[3] = ldapgroups
			new_data[4] = ldapcttees
			window.localStorage.setItem("phonebook_" + now, JSON.stringify(new_data))
		}
        allDone()
    }
}

// Called by phonebook.html: body onload="getAsyncJSON('https://whimsy.apache.org/public_ldap_people.json', null, renderPhonebook)"

function renderPhonebook(xjson) {
	
	// Cache data for an hour - no sense in continuously reloading this
	var now = parseInt(new Date().getTime() / (3600*1000))
	if (typeof(window.localStorage) !== "undefined") {
        var old_data = window.localStorage.getItem("phonebook_" + now)
		if (old_data && old_data.length == 5) {
            members = old_data[0]
			committees = old_data[1]
			iclainfo = old_data[2]
			ldapgroups = old_data[3]
			ldapcttees = old_data[4]
			allDone()
			return
        }
    }
	
    people = xjson.people
	asyncCalls = 5 // how many async GETs need to complete before were are done
    getAsyncJSON('https://whimsy.apache.org/public/member-info.json',    members,    saveData)
    getAsyncJSON('https://whimsy.apache.org/public/committee-info.json', committees, saveData) 
    getAsyncJSON('https://whimsy.apache.org/public/icla-info.json',      iclainfo,   saveData)
    getAsyncJSON('https://whimsy.apache.org/public/public_ldap_groups.json', ldapgroups,   saveData)
    getAsyncJSON('https://whimsy.apache.org/public/public_ldap_committees.json', ldapcttees,   saveData)
}

// Called when all the async GETs have been completed

function allDone() {
    ldapcttees = ldapcttees.committees // subhash
    ldapgroups = ldapgroups.groups // keep subhash
	pmcs = []
	for (var k in committees.committees) { // actual committees, not LDAP committee groups
	    if (committees.committees[k].pmc) { // skip non-PMCs
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
	committees.committees['member'] = {
	    'roster': mMap,
        'display_name': 'Foundation Members',
        'description': "ASF membership (PMC members == current members, Committers == those with member karma)",
        'site': 'http://www.apache.org/foundation/'
        }

    // Match user=name and project=name
	var u = document.location.search.match(/user=([-.a-z0-9]+)/i)
	var p = document.location.search.match(/project=([-.a-z0-9]+)/i)

	// Match ?uid=id
    var uid = document.location.search.match(/^\?uid=([-.a-z0-9]+)/i)
    // Match ?pmc=id
    var pmc = document.location.search.match(/^\?pmc=([-.a-z0-9]+)/i)

    if (u) {
		searchCommitters(u[1], true)
	} else if (p) {
		searchProjects(p[1], true)
    } else if (uid) {
        showUid(uid[1])
    } else if (pmc) {
        showPMC(pmc[1])
	} else {
		searchProjects("")
	}
}


