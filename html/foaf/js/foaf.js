/*
 * Description: Javascript FOAF helper objects and utilties.
 *
 * Author: Leigh Dodds, leigh@ldodds.com
 *
 * License: Consider this PUBLIC DOMAIN code, do with it what you will, 
 *          just mention where you got it. Cheers.
 *
 *
 */

/* =========================== Globals ============================= */

//We doan need no steenkin' globals!
//Um actually we do...

gSpamProtect = false;

gGeneratorAgent = 'http://asylum.zones.apache.org/community/site/foaf-a-matic';
gErrorReportsTo = 'mailto:site-dev@apache.org';

/* =========================== Globals ============================= */

/* ======================== Person Object =========================== */
function Person()
{
    //properties
    this.avail = '';
    this.title = '';
    this.firstName = '';
    this.surname = '';
    this.name = '';
    this.nick = '';
    this.email = '';
    this.homePage = '';
    this.depiction = '';
    this.seealso = '';
    this.lat = '';
    this.lng = '';

    this.emails = new Array();
    this.weblogs = new Array();
    this.twitters = new Array();
    this.keys = new Array();
    this.projects = new Array();
    this.ircs = new Array();

    //methods
    this.getName = getName;
    this.mbox = mbox;
    this.dumpToTextArea = dumpToTextArea;
    this.toFOAF = toFOAF;
    this.addEmail = addEmail;
    this.addWeblog = addWeblog;
    this.addTwitter = addTwitter;
    this.addKey = addKey;
    this.addProject = addProject;
    this.addIRC = addIRC;
}

function Weblog()
{
    this.name = '';
    this.url = '';
    this.rssFeed = '';

    this.makeRDF = weblogRDF;
}

function Project()
{
    this.name = '';
    this.url = '';

    this.makeRDF = projectRDF;
}

function Key()
{
    this.hex_id = '';
    this.fingerprint = '';
}

function addEmail(email)
{
    this.emails[this.emails.length] = email;
}

function addIRC(irc)
{
    this.ircs[this.ircs.length] = irc;
}

function addTwitter(twitter)
{
    this.twitters[this.twitters.length] = twitter;
}

function addWeblog(n, u, l, f)
{
    var w = new Weblog();

    w.name = n;
    w.url = u;
    w.rssFeed = f;
    w.lang = l;

    this.weblogs[this.weblogs.length] = w;
}

function addKey(f, id)
{
    var k = new Key();
    k.hex_id = id;
    k.fingerprint = f;
    this.keys[this.keys.length] = k;
}

function addProject(n, u)
{
    var p = new Project();

    p.name = n;
    p.url = u;

    this.projects[this.projects.length] = p;
}

function getName()
{
    return (this.name != '' ? this.name : this.firstName + ' ' + this.surname);
}

function mbox(email)
{
    return 'mailto:' + email;
}

function dumpToTextArea(textarea)
{
    textarea.value = this.toFOAF();
}

function toFOAF()
{
    serializer = new PersonSerializer(this);
    return serializer.getFOAF();
}

/* ======================== Person Object =========================== */

/* ===================== Person Serializer Object ======================= */

//Note: I could have simply built up a DOM tree for the FOAF elements, and
//then serialized this, rather than using this object+methods. However I wasn't
//confident in getting DOM accesses to work cross-browser. I may still do it
//however. It was also easy to port my first code iteration to this structure.

function PersonSerializer(p, merging)
{
    //properties
    this.person = p;
    this.top = '<?xml version=\"1.0\" encoding="UTF-8"?>\n<rdf:RDF\n' +
         '      xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"\n' +
         '      xmlns:rdfs=\"http://www.w3.org/2000/01/rdf-schema#\"\n' +
         '      xmlns:foaf=\"http://xmlns.com/foaf/0.1/\"\n' +
         '      xmlns:geo=\"http://www.w3.org/2003/01/geo/wgs84_pos#\"\n' +
         '      xmlns:pm=\"http://www.web-semantics.org/ns/pm#\"\n' +
         '      xmlns:wot=\"http://xmlns.com/wot/0.1/\"\n' +
         '      xmlns:rss=\"http://purl.org/rss/1.0/\"\n' +
         '      xmlns:dc=\"http://purl.org/dc/elements/1.1/\"\n' +
         '      xmlns:doap=\"http://usefulinc.com/ns/doap#\">\n';
    this.tail = '</rdf:RDF>';
    this.merging = merging || false;

    //methods
    this.getFOAF = getFOAF;
    this.makePerson = makePerson;
    this.makeName = makeName;
    this.makeNick = makeNick;
    this.makeMbox = makeMbox;
    this.makeHome = makeHome;
    this.makeDepiction = makeDepiction;
    this.makeSeeAlso = makeSeeAlso;
    this.makeWeblogs = makeWeblogs;
    this.makeTwitters = makeTwitters;
    this.makeKeys = makeKeys;
    this.makeGeo = makeGeo;
    this.makeProjects = makeProjects;
    this.makeIRC = makeIRC;
}

function getFOAF()
{
    return this.top + this.makePerson() + this.tail;
}

function makePerson()
{
    var body = this.makeName() +
               this.makeNick() +
               this.makeMbox() +
               this.makeHome() +
               this.makeDepiction() +
               this.makeWeblogs() +
               this.makeTwitters() +
               this.makeKeys() +
               this.makeGeo() +
               this.makeProjects() +
               this.makeIRC();

    return makeAttributeTag('foaf', 'Person', body, 'rdf:ID', 
                            this.person.avail);
}

function makeFriends()
{
    var friends = '';

    if (this.person.friends.length == 0)
    {
        return friends;
    }

    for (i=0; i<this.person.friends.length;i++)
    {
        serializer = new PersonSerializer(this.person.friends[i], true);
        friends = friends + serializer.getFOAF();
    }
    return friends;
}

function makeSeeAlso()
{
    if (this.person.seealso == '')
    {
        return '';
    }

    return makeRDFResourceTag('rdfs', 'seeAlso', this.person.seealso);
}

function makeName()
{
    return makeSimpleTag('foaf', 'name', this.person.getName()) +
             (this.person.title == '' ? '' : makeSimpleTag('foaf', 'title', this.person.title) ) +
             (this.person.firstName == '' ? '' : makeSimpleTag('foaf', 'givenname', this.person.firstName)) +
             (this.person.surname == '' ? '' : makeSimpleTag('foaf', 'family_name', this.person.surname));
}

function makeNick()
{
    if (this.person.nick == '')
    {
        return '';
    }
    return makeSimpleTag('foaf', 'nick', this.person.nick);
}

function makeMbox()
{
    if (this.person.emails.length == 0) {
        return '';
    }
    var output = '';
    for (i = 0; i < this.person.emails.length; i++) {
        output = output + makeRDFResourceTag('foaf', 'mbox',
                                             mbox(this.person.emails[i]));
    }

    return output;
}

function makeWeblogs()
{
    if (this.person.weblogs.length == 0) {
        return '';
    }
    var output = '';
    for (i = 0; i < this.person.weblogs.length; i++) {
        output = output + this.person.weblogs[i].makeRDF();
    }

    return output;
}

function makeTwitters()
{
    if (this.person.twitters.length == 0) {
        return '';
    }

    var output = '';
    var twitterRoot = "http://twitter.com/";
    for (i = 0; i < this.person.twitters.length; i++) {
        var id = this.person.twitters[i];
        output = output + makeOpeningTag("foaf", "OnlineAccount") + "\n";
        output = output + "  " + makeSimpleTag("foaf", "accountName", id);
        output = output + "  " + makeRDFResourceTag("foaf", "accountProfilePage", twitterRoot+id);
        output = output + "  " + makeRDFResourceTag("foaf", "accountServiceHomepage", twitterRoot);
        output = output + makeClosingTag("foaf", "OnlineAccount");
    }

    return output;
}

function makeProjects()
{
    if (this.person.projects.length == 0) {
        return '';
    }
    var output = '';
    for (i = 0; i < this.person.projects.length; i++) {
        if (this.person.projects[i].name != '') {
            output = output + this.person.projects[i].makeRDF();
        }
    }

    return output;
}

/*
    <wot:hasKey>
      <wot:PubKey>
        <wot:fingerprint>B43FA90B132CBC00DC26C779C97C50965C1C3AD7</wot:fingerprint>
      </wot:PubKey>
    </wot:hasKey>
*/
function makeKeys()
{
    if (this.person.keys.length == 0) {
        return '';
    }
    var output = '';
    for (i = 0; i < this.person.keys.length; i++) {
        var inner = makeSimpleTag('wot', 'fingerprint', 
                                  this.person.keys[i].fingerprint);
        inner = inner + makeSimpleTag('wot', 'hex_id',
                                      this.person.keys[i].hex_id);
        var l = makeSimpleTag('wot', 'PubKey', inner);
        output = output + makeSimpleTag('wot', 'hasKey', l);
    }
    return output;
}

/*
    <foaf:based_near>
      <geo:Point>
        <geo:lat>51.1500</geo:lat>
        <geo:long>-0.1500</geo:long>
      </geo:Point>
    </foaf:based_near>
*/
function makeGeo()
{
    if (this.person.lat == '' || this.person.lng == '') {
        return '';
    }
    var inner = makeSimpleTag('geo', 'lat', this.person.lat);
    inner = inner + makeSimpleTag('geo', 'long', this.person.lng);
    inner = makeSimpleTag('geo', 'Point', inner);
    return makeSimpleTag('foaf', 'based_near', inner);
}

function makeHome()
{
    if (this.person.homePage == 'http://') {
        return '';
    }

    return makeRDFResourceTag('foaf', 'homepage', this.person.homePage);
}

function makeDepiction()
{
    if (this.person.depiction.indexOf('noimage.gif'))
    {
        return '';
    }
    return makeRDFResourceTag('foaf', 'depiction', this.person.depiction);
}


function makeIRC()
{
    if (this.person.ircs.length == 0) {
        return '';
    }
/* TODO Convert to: */
/*
  <foaf:account>
    <foaf:OnlineAccount>
      <rdf:type rdf:resource="http://xmlns.com/foaf/0.1/OnlineChatAccount"/>
      <foaf:accountServiceHomepage 
               rdf:resource="http://www.freenode.net/"/>
      <foaf:accountName>UserNameHere</foaf:accountName>
    </foaf:OnlineAccount>
  </foaf:account>
*/
    var output = '';
    for (i = 0; i < this.person.ircs.length; i++) {
        output = output + makeSimpleTag('foaf', 'ircChatID',
                                             this.person.ircs[i]);
    }

    return output;
}

/* ===================== Person Serializer Object ======================= */

/*
    <foaf:weblog>
      <dc:title><name></dc:title>
      <foaf:Document rdf:about="<url>">
        <rdfs:seeAlso>
          <rss:channel rdf:about="<rssFeed>"/>
        </rdfs:seeAlso>
      </foaf:Document>
    </foaf:weblog>
*/
function weblogRDF()
{
    if (this.name == '' || this.url == 'http://') {
        return '';
    }
    var inner = makeSimpleTag('dc', 'title', this.name);
    if (this.rssFeed != '') {
        var ch = makeRDFAboutTag('rss', 'channel', this.rssFeed);
        inner = inner + makeSimpleTag('rdfs', 'seeAlso', ch);
    }
    var doc = makeAttributeTag('foaf', 'Document', inner, 'rdf:about', this.url);
    
    if (this.lang != '') {
        return makeAttributeTag('foaf', 'weblog', doc, 'lang', this.lang);
    } else {
        return makeSimpleTag('foaf', 'weblog', doc);
    }
}

/*
    <foaf:currentProject>
      <pm:name>[name]</pm:name>
      <pm:homepage rdf:resource="[url]"/>
    </foaf:currentProject>
*/
function projectRDF()
{
    if (this.name == '') { return ''; }

    var inner = makeSimpleTag('pm', 'name', this.name);
    inner = inner + makeRDFResourceTag('pm', 'homepage', this.url);
    return makeSimpleTag('foaf', 'currentProject', makeSimpleTag('doap', 'Project', inner));
}

/* ====================== XML Utility Methods ========================= */

function makeRDFResourceTag(prefix, localname, resource)
{
    return  '<' + prefix + ':' + localname + ' rdf:resource=\"' +
            resource + '\"/>\n';
}

function makeRDFAboutTag(prefix, localname, resource)
{
    return  '<' + prefix + ':' + localname + ' rdf:about=\"' +
            resource + '\"/>\n';
}

function makeSimpleTag(prefix, localname, contents, id)
{
    if (id) {
        return makeOpeningTagAttribute(prefix, localname, "id", id) + 
               contents + makeClosingTag(prefix, localname);
    } else {
        return makeOpeningTagAttribute(prefix, localname) + 
               contents + makeClosingTag(prefix, localname);
    }
}

function makeAttributeTag(prefix, localname, contents, attr, val)
{
    return  makeOpeningTagAttribute(prefix, localname, attr, val) + 
            contents + makeClosingTag(prefix, localname);
}

function makeOpeningTag(prefix, localname)
{
    return '<' + prefix + ':' + localname + '>';
}

function makeOpeningTagAttribute(prefix, localname, attr, val)
{
    var tag = prefix + ':' + localname;
    if (attr) {
        return '<' + tag + ' ' + attr + '="' + val + '">\n';
    } else {
        return '<' + tag + '>';
    }
}

function makeClosingTag(prefix, localname)
{
    return '</' + prefix + ':' + localname + '>\n';
}
/* ====================== XML Utility Methods ========================= */
