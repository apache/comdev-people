/*
 * Description: Javascript FOAF-a-matic implementation
 *
 * Author: Leigh Dodds, leigh@ldodds.com
 *
 * License: Consider this PUBLIC DOMAIN code, do with it what you will,
 * just mention where you got it. Cheers.
 */

/* =========================== Globals ============================= */
var gCurrentNumberOfEmails = 0;
var gCurrentNumberOfWeblogs = 0;
var gCurrentNumberOfTwitter = 0;
var gCurrentNumberOfKeys = 0;
var gCurrentNumberOfProjects = 0;
var gCurrentNumberOfIRC = 0;

/* =========================== Globals ============================= */

/* =========================== Generate ============================= */

function generate()
{
    if (validate())
    {
        //clear text area
        document.results.rdf.value='';

        //process the form values to make a FOAF person
        person = buildPerson();

        //dump the final RDF description
        person.dumpToTextArea(document.results.rdf);
    }
}
/* =========================== Generate ============================= */

/* =========================== Build Person =========================== */
function buildPerson()
{
    p = new Person();

    p.avail = document.details.avail.value;
    p.title = document.details.title.value;
    p.firstName = document.details.firstName.value;
    p.surname = document.details.lastName.value;
    p.homePage = document.details.homepage.value;
    p.depiction = document.details.iMyImg.src;
    p.lat = document.details.lat.value;
    p.lng = document.details.lng.value;

    for (i=1; i <= gCurrentNumberOfEmails;i++) {
        if (document.details.elements['email_' + i].value != '') {
            p.addEmail(document.details.elements['email_' + i].value);
        }
    }

    for (i=1; i <= gCurrentNumberOfWeblogs;i++) {
        var n = document.details.elements['wb_name_' + i].value;
        var u = document.details.elements['wb_url_' + i].value;
//        var l = document.details.elements['wb_lang_' + i].value;
        var l = '';
        if (n != '' && u != '') {
            p.addWeblog(n, u, l, document.details.elements['wb_rss_' + i].value);
        }
    }

    for (i=1; i <= gCurrentNumberOfTwitter; i++) {
        var n = document.details.elements['twitter_' + i].value;
        if (n != '') {
            p.addTwitter(n);
        }
    }

    for (i=1; i <= gCurrentNumberOfKeys;i++) {
        if (document.details.elements['key_' + i].value != '') {
            var k = document.details.elements['key_' + i].value;
            var id = document.details.elements['id_' + i].value;
            p.addKey(k, id);
        }
    }

    for (i=1; i <= gCurrentNumberOfProjects;i++) {
        var n = document.details.elements['p_name_' + i].value;
        var u = document.details.elements['p_url_' + i].value;
        if (n != '' || u != '') {
            p.addProject(n, u);
        }
    }

    for (i=1; i <= gCurrentNumberOfIRC; i++) {
        var n = document.details.elements['irc_' + i].value;
        if (n != '') {
            p.addIRC(n);
        }
    }

    return p;
}
/* =========================== Build Person =========================== */

/* ========================== Form Validation ========================== */

// Check we have all the bits of information we need to create a file.
// Presently this is just
//    - avail id
//    - first name
//    - last name
function validate()
{

    isValid = true;
    msg = '';

    if (document.details.firstName.value == '') {
        isValid=false;
    }

    if (document.details.lastName.value == '') {
        isValid=false;
    }

    if (document.details.avail.value == '') {
        isValid=false;
    }

    if (isNaN(document.details.lat.value)||isNaN(document.details.lng.value)) {
        msg='Location must use decimal degrees, not degrees/minutes/seconds';
        isValid=false;
    }

    if (!isValid) {
        alert('Some data is missing or incorrect' + '\n' + msg);
    }

    return isValid;
}
/* ========================== Form Validation ========================== */

/* ========================== Form Utilities ============================ */

function addEmailField()
{
    gEmailTableBody = document.getElementById('emailTable');
    gCurrentNumberOfEmails++;
    tr = document.createElement('tr');
    tr.appendChild(addCol('<input type=\"text\" name=\"email_'+
                          gCurrentNumberOfEmails+'\" value="" size="50">'));
    gEmailTableBody.appendChild(tr);
}

function addIRCField()
{
    gIRCTableBody = document.getElementById('ircTable');
    gCurrentNumberOfIRC++;
    tr = document.createElement('tr');
    tr.appendChild(addCol('<input type=\"text\" name=\"irc_'+
                          gCurrentNumberOfIRC+'\" value="" size="50">'));
    gIRCTableBody.appendChild(tr);
}

function addTwitterField()
{
    gTwitterTableBody = document.getElementById('twitterTable');
    gCurrentNumberOfTwitter++;
    tr = document.createElement('tr');
    tr.appendChild(addCol('<input type=\"text\" name=\"twitter_'+
                          gCurrentNumberOfTwitter+'\" value="" size="50">'));
    gTwitterTableBody.appendChild(tr);
}

function addWeblogField()
{
    gWeblogTableBody = document.getElementById('weblog');
    gCurrentNumberOfWeblogs++;
    tr1 = document.createElement('tr');
    tr1.appendChild(addCol('Name'));
    tr1.appendChild(addCol('<input type=\"text\" name=\"wb_name_'+
                          gCurrentNumberOfWeblogs+'\" size="50">'));

/*
    tr2 = document.createElement('tr');
    tr2.appendChild(addCol('Language'));
    tr2.appendChild(addCol('<input type=\"text\" name=\"wb_lang_'+
                          gCurrentNumberOfWeblogs+'\" size="5"> <small>(if not english - 2 letter code)<\/small>'));
*/
    tr3 = document.createElement('tr');
    tr3.appendChild(addCol('URL'));
    tr3.appendChild(addCol('<input type=\"text\" name=\"wb_url_'+
                          gCurrentNumberOfWeblogs+'\" value="http://" size="50">'));

    tr4 = document.createElement('tr');
    tr4.appendChild(addCol('RSS Feed'));
    tr4.appendChild(addCol('<input type=\"text\" name=\"wb_rss_'+
                          gCurrentNumberOfWeblogs+'\" value="http://" size="50">'));

    gWeblogTableBody.appendChild(tr1);
//    gWeblogTableBody.appendChild(tr2);
    gWeblogTableBody.appendChild(tr3);
    gWeblogTableBody.appendChild(tr4);
}

function addPGPField()
{
    gKeyTableBody = document.getElementById('pgpTable');
    gCurrentNumberOfKeys++;
    tr = document.createElement('tr');
    tr.appendChild(addCol('Key ID: <input type=\"text\" name=\"id_' +
                          gCurrentNumberOfKeys + '\" size="10">' +
                          '<small>Hex ID (8 chars)</small>'));
    tr2 = document.createElement('tr');
    tr2.appendChild(addCol('Fingerprint: <input type=\"text\" name=\"key_' +
                          gCurrentNumberOfKeys + '\" size="40">'));

    gKeyTableBody.appendChild(tr);
    gKeyTableBody.appendChild(tr2);
}

function addProjectField()
{
    gProjectsTableBody = document.getElementById('projectTable');
    gCurrentNumberOfProjects++;
    tr1 = document.createElement('tr');
    tr1.appendChild(addCol('Name'));
    tr1.appendChild(addCol('<input type=\"text\" name=\"p_name_'+
                          gCurrentNumberOfProjects+'\" size="40">'));

    tr2 = document.createElement('tr');
    tr2.appendChild(addCol('URL'));
    tr2.appendChild(addCol('<input type=\"text\" name=\"p_url_'+
                          gCurrentNumberOfProjects+'\" value="http://" size="50">'));

    gProjectsTableBody.appendChild(tr1);
    gProjectsTableBody.appendChild(tr2);
}

function createFriendFields()
{
    gFriendTableBody = document.getElementById('friendtable');
    for (i=1; i<=gDefaultNumberOfFriends; i++)
    {
        addFriendFields();
    }

    //if we've been referred, then populate first friend
    if (gReferredFriend != null)
    {
        document.friends[0].value = gReferredFriend.friendname;
        document.friends[1].value = gReferredFriend.email;
        document.friends[2].value = gReferredFriend.seealso;
    }
}

function addFriendFields()
{
    gCurrentNumberOfFriends++;
    tr = document.createElement('tr');
    tr.appendChild(addCol(field_friend + '--'));
    tr.appendChild(addCol(field_friendName));
    tr.appendChild(addCol('<input type=\"text\" name=\"friend_'+gCurrentNumberOfFriends+'\" value="">'));
    tr.appendChild(addCol(field_friendEmail));
    tr.appendChild(addCol('<input type=\"text\" name=\"friend_'+gCurrentNumberOfFriends+'_mbox\" value="">'));
    tr.appendChild(addCol(field_friendSeeAlso));
    tr.appendChild(addCol('<input type=\"text\" name=\"friend_'+gCurrentNumberOfFriends+'_seealso\" value="">'));

    gFriendTableBody.appendChild(tr);
}

function addCol(html) {
   var td=document.createElement('td')
   td.innerHTML=html
   return td
}


/* ========================== Form Utilities ============================ */

/* ========================== Refer a Friend ============================ */

gReferredFriend = null;

function ReferredFriend(friendname, surname, email, seealso)
{
    this.friendname= friendname || '';
    this.email = email || '';
    this.seealso=seealso || '';
}

function checkParameters()
{
    rawParameters = document.location.search;

    if (rawParameters == '')
    {
        return;
    }

    rawParametersArray = rawParameters.substring(1).split("&");
    gReferredFriend = new ReferredFriend();

    for (i=0; i<rawParametersArray.length; i++)
    {
        nameAndValue = rawParametersArray[i].split("=");
        if (nameAndValue[0] == 'name')
        {
            gReferredFriend.friendname=unescape(nameAndValue[1]);
        }
        if (nameAndValue[0] == 'email')
        {
            gReferredFriend.email=unescape(nameAndValue[1]);
        }
        if (nameAndValue[0] == 'seealso')
        {
            gReferredFriend.seealso=unescape(nameAndValue[1]);
        }
    }
}

