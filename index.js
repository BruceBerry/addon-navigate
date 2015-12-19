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

// if doOff = false, then the off part is immediately completed
var isHalfCompleted = function(h, opts) {
  return !h || h.times.length >= opts.times || h.errors >= opts.errors;
};

var isSiteCompleted = function(s, opts) {
  return isHalfCompleted(s.on, opts) && isHalfCompleted(s.off, opts);
};

var notc = f => function() { return !f.apply(this, arguments); };


// main entry point:
// sites: array of sites (new navigation) or result of cbs.end (completed/in progress)
// opts: times, errors, random, doOff, timeout, loadDelay
// cbs: end(sites), extraprefs()/extraglobals(), turnOn()/turnOff(), beforeOpen(site, which)/beforeClose(site, which, tab, isTimeout)
exports.navigate = function(sites, opts, cbs) {
  if (sites.length === 0)
    return cbs.end && cbs.end();
  // if input is a simple array list, prepare the proper format
  if (typeof sites[0] === "string")
    sites = sites.map(function(site, i) {
      return {id: i, url: site, on: {times: [], errors: 0}, off: opts.doOff ? {times: [], errors: 0} : undefined};
    });

  console.log("Sites left: ", sites.filter(notc(isSiteCompleted)).length);
  
  // prefs.set("permissions.default.image", 2);
  prefs.set("browser.helperApps.alwaysAsk.force", false);
  prefs.set("browser.helperApps.neverAsk.saveToDisk", saveMime.join(","));
  prefs.set("browser.download.defaultFolder", "/tmp");
  cbs.extraPrefs && cbs.extraPrefs(prefs);

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
  var shift = opts.random ? Math.floor(Math.random() * sites.length) : 0;
  for (var i = 0; i < sites.length; i++) {
    var site = sites[(shift + i) % sites.length];
    if (!isSiteCompleted(site, opts))
      return site;
  }
  return null;
};

var doOne = function(sites, opts, cbs) {
  var site = pick(sites, opts);
  if (!site)
    return cbs.end(sites);

  // first do 'on', then 'off'
  var whichKey = !isHalfCompleted(site.on, opts) ? "on": "off"; // they can't be both complete
  var which = site[whichKey];
  which === site.on ? (cbs.turnOn && cbs.turnOn()) : (cbs.turnOff && cbs.turnOff());

  cbs.beforeOpen && cbs.beforeOpen(site, whichKey);

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
        cbs.beforeClose && cbs.beforeClose(site, whichKey, tab, true);
        tab.close();
        doOne(sites, opts, cbs);
      }, opts.timeout * 1000);
    },
    onLoad: function(tab) {
      console.log("Load event for ", tab.url);
      timers.clearTimeout(timeoutId);
      var endTime = (new Date()).getTime();
      which.times.push(endTime - startTime);

      timers.setTimeout(function() {
        cbs.beforeClose && cbs.beforeClose(site, whichKey, tab, false);
        tab.close();
        doOne(sites, opts, cbs);
      }, opts.loadDelay * 1000);
    }
  });

};