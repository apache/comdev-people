var pmcs = []
var json = {}
var members = {} // copy of member-info.json
var committees = {} // copy of committee-info.json (plus details for 'member' dummy PMC
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
    for (var i in json.projects) {
        for (var n in json.projects[i]) {
            if (json.projects[i][n] == uid) {
                cl.push(i)
            }
        }
    }
    return cl
}

function getCommittees(uid) {
    var pl = []
    for (var i in committees.committees) {
        if (uid in committees.committees[i].roster) {
            pl.push(i)
        }
    }
    return pl
}

function getCommitterName(uid) {
    var name = json.committers[uid]
    if (!name) {
        name = iclainfo.committers[uid]
    }
    return name
}

function showCommitter(obj, uid) {
	var details = document.getElementById('details_committer_' + uid)
	if (!details) {
		details = document.createElement('p')
		details.setAttribute("id", 'details_committer_' + uid)
		var cl = getProjects(uid)
        var pl = getCommittees(uid)
		if (isMember(uid)) {
			details.innerHTML += "<img src='asfmember.png' style='vertical-align: middle;'/> <i>Foundation member</i><br/><br/>"
		}
		if (cl.length > 0) {
			details.innerHTML += "<b>Committer on:</b> " + cl.join(", ") + "<br/><br/>"
		}
		if (pl.length > 0) {
			details.innerHTML += "<b>PMC member of:</b> " + pl.join(", ") + "<br/><br/>"
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
		var pl = getCommittees(uid)
		if (isMember(uid) == true) {
			div.innerHTML += "<img src='asfmember.png' style='vertical-align: middle;'/> <i>Foundation member</i><br/><br/>"
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

function isMember(uid) {
    return members['members'].indexOf(uid) > -1
}

function hiliteMember(uid) {
    if (isMember(uid)) {
        return "<b>" + uid + "</b>"
    } else {
        return uid
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
		details.innerHTML += "<b>Description:</b><br/><br/>" + desc + "<br/><br/>"
		var cl
		try { 
		  cl = json.projects[uid].slice()
	    } catch(err) { // Allow for broken json generated by people.lua (INFRA-10888)
	      cl = []
	    }
		var pl = []
		var pmc = committees.committees[uid] 
		if (pmc) {
            for(var c in pmc.roster) {
              pl.push(c)
            }
		}
		cl.sort()
		pl.sort()
		for (var i in cl) {
			cl[i] = "<li onmouseover='hoverCommitter(this, \"" + cl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(cl[i]) + "</kbd> - " + getCommitterName(cl[i]) + "</li>"
		}
		for (var i in pl) {
			pl[i] = "<li onmouseover='hoverCommitter(this, \"" + pl[i] + "\");' onmouseout='hoverCommitter(this, null);'><kbd>" + hiliteMember(pl[i]) + "</kbd> - " + getCommitterName(pl[i]) + "</li>"
		}
		
		if (pl.length > 0) {
			details.innerHTML += "<b>PMC members:</b> <ul>" + pl.join("\n") + "</ul><br/>"
		}
		
		if (cl && cl.length > 0) {
			details.innerHTML += "<b>Committers:</b> <ul>" + cl.join("\n") + "</ul><br/>"
		}
		
		obj.appendChild(details)
	} else {
		obj.removeChild(details)
	}
}

function searchProjects(keyword, open) {
	var obj = document.getElementById('phonebook')
	obj.innerHTML = "<h3>Search results:</h3><hr/>"
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

function searchCommitters(keyword, open) {
	if (keyword.length < 2) {
		return
	}
	var n = 0
	var obj = document.getElementById('phonebook')
	obj.innerHTML = "<h3>Search results:</h3><hr/>"
	for (var uid in json.committers) {
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

function saveData(xjson, xdata) {
    // Copy the json contents
    for (var k in xjson) {
        xdata[k] = xjson[k]
    }
    asyncCalls -= 1
    if (asyncCalls <= 0) {
        allDone()
    }
}

// Called by phonebook.html: body onload="getAsyncJSON('committers.json', null, renderPhonebook)"

function renderPhonebook(xjson) {
	json = xjson
	delete json.committees // not needed currently
	asyncCalls = 3 // how many async GETs need to complete before were are done
    getAsyncJSON('https://whimsy.apache.org/public/member-info.json',    members,    saveData)
    getAsyncJSON('https://whimsy.apache.org/public/committee-info.json', committees, saveData) 
    getAsyncJSON('https://whimsy.apache.org/public/icla-info.json',      iclainfo,   saveData) 
}

// Called when all the async GETs have been completed

function allDone() {
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
	committees.committees['member'] = {'roster': mMap,
        'display_name': 'Foundation Members',
        'description': "ASF membership (PMC members == current members, Committers == those with member karma"}
	var u = document.location.search.match(/user=([-.a-z0-9]+)/i)
	var p = document.location.search.match(/project=([-.a-z0-9]+)/i)
    if (u) {
		searchCommitters(u[1], true)
	} else if (p) {
		searchProjects(p[1], true)
	} else {
		searchProjects("")
	}
}


