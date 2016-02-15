var nonCommitters = {} // copy of icla-info.json (non-committers only)

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

function preRender() {
    getAsyncJSONArray([
        ['https://whimsy.apache.org/public/icla-info.json',              "iclainfo",   function(json) { nonCommitters = json.non_committers; }],
        ],
        allDone);
}

// Called when all the async GETs have been completed

function allDone() {
  try {
	    var obj = document.getElementById('phonebook')
	    // clears the 'loading' message
	    obj.innerHTML = "<h1>CLAs without ids</h1>"
	    var number = nonCommitters.length
	    var para = document.createElement('p');
	    para.appendChild(document.createTextNode("Number of CLAs listed: " + number));
	    obj.appendChild(para);

	    var table = document.createElement('table');
	    table.border='1';
	   
	    var tableBody = document.createElement('tbody');
	    table.appendChild(tableBody);
	    var COLS = 4
	    var tr
	    for (var i = 0; i < number; i++) {
	    	if (i % COLS == 0) {
	 	       tr = document.createElement('tr');
		       tableBody.appendChild(tr);	    		
	    	}
           var td = document.createElement('td');
           td.appendChild(document.createTextNode(nonCommitters[i]));
           tr.appendChild(td);
	    }
	    for ( ; i % COLS > 0 ; i++) { // fill remaining columns
           var td = document.createElement('td');
           td.appendChild(document.createTextNode("\u00a0")); // NBSP
           tr.appendChild(td);	    	
	    }
	    obj.appendChild(table);
	   	    
  } catch (error) {
    showError(error)
  }
}


