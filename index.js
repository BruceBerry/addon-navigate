var prefs = require("sdk/preferences/service");
var tabs = require("sdk/tabs");
var timers = require("sdk/timers");
var {Cc, Ci} = require("chrome");

var addGlobals = require("./add-globals");

var saveMime = [
  "application/x-msdos-program",
  "application/x-unknown-application-octet-stream",
  "application/vnd.ms-powerpoint","application/excel",
  "application/vnd.ms-publisher",
  "application/x-unknown-message-rfc822",
  "application/vnd.ms-excel",
  "application/msword",
  "application/x-mspublisher",
  "application/x-tar",
  "application/zip",
  "application/x-gzip",
  "application/x-stuffit",
  "application/vnd.ms-works",
  "application/powerpoint",
  "application/rtf",
  "application/postscript",
  "application/x-gtar",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  "audio/x-wav",
  "audio/x-midi",
  "audio/x-aiff",
  "application/pdf",
  "application/x-chm",
  "application/chm",
  "chemical/x-chemdraw"
];

var cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);

var isSiteCompleted = function(s, opts) {
  return (s.on.times.length >= opts.times && s.off.times.length >= opts.times) ||
    (s.on.errors + s.off.errors >= opts.errors);
};

var notc = f => function() { return !f.apply(this, arguments); };


// main entry point:
// sites: array of sites (new navigation) or result of cbs.end (completed/in progress)
// opts: times, errors, random, doOff, loadDelay
// cbs: end(sites), extraprefs()/extraglobals(), turnOn()/turnOff(), beforeOpen(site, which)/beforeClose(site, which, tab, isTimeout)
exports.navigate = function(sites, opts, cbs) {
  if (sites.length === 0)
    return cbs.end && cbs.end();
  // if input is a simple array list, prepare the proper format
  if (Array.isArray(sites[0]))
    sites = sites.map(function(site, i) {
      return {id: i, url: site, on: {times: [], errors: 0}, off: {times: [], errors: 0}};
    });

  console.log("Sites left: ", sites.filter(notc(isSiteCompleted)).length);
  
  // prefs.set("permissions.default.image", 2);
  prefs.set("browser.helperApps.alwaysAsk.force", false);
  prefs.set("browser.helperApps.neverAsk.saveToDisk", saveMime);
  prefs.set("browser.download.defaultFolder", "/tmp");
  cbs.extraPrefs && cbs.extraPrefs();

  addGlobals(function(w, cloner) {
    w.alert = function() { };
    w.confirm = function() { return false; };
    w.prompt = function() { return null; };
    w.print = function() { return false; };
    w.__addEventListener = w.addEventListener;
    w.addEventListener = function(eventType, fun, bubble) {
    if (eventType.toLowerCase() !== "beforeunload")
      return w.__addEventListener(eventType, fun, bubble);
    };
    cbs.extraGlobals && cbs.extraGlobals(w, cloner);
  });

  doOne(sites, opts, cbs);
};

var pick = function(sites, opts) {
  var remaining = sites.filter(notc(isSiteCompleted));
  if (remaining.length === 0)
    return null;
  if (opts.random) {
    return remaining[Math.floor(Math.random() * remaining.length)];
  } else {
    return remaining[0];
  }
};

var doOne = function(sites, opts, cbs) {
  var site = pick(sites, opts);
  if (!site)
    return cbs.end();

  // first do 'on', then 'off'
  var which = (site.on.times.length < opts.times && site.on.errors < opts.errors) ?
    site.on : site.off;
  which === site.on ? (cbs.turnOn && cbs.turnOn()) : (cbs.turnOff && cbs.turnOff());

  cbs.beforeOpen && cbs.beforeOpen(site, which);

  cookieManager.removeAll();

  var startTime, timeoutId;
  tabs.open({
    url: site.url,
    inNewWindow: false,
    onOpen: function(tab) {
      startTime = (new Date()).getTime();
      timeoutId = timers.setTimeout(function() {
        console.log("Timeout for tab ", tab.url);
        which.errors++;
        cbs.beforeClose && cbs.beforeClose(site, which, tab, true);
        tab.close();
        doOne(sites, opts, cbs);
      }, opts.timeout);
    },
    onLoad: function(tab) {
      console.log("Load event for ", tab.url);
      timers.clearTimeout(timeoutId);
      var endTime = (new Date()).getTime();
      which.times.push(endTime - startTime);

      timers.setTimeout(function() {
        cbs.beforeClose && cbs.beforeClose(site, which, tab, false);
        tab.close();
        doOne(sites, opts, cbs);
      }, opts.loadDelay);
    }
  });

};