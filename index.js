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

Array.prototype.pick = function() {
  return this[Math.floor(Math.random() * this.length)];
};

var cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);

// if doOff = false, then the off part is immediately completed
var isHalfCompleted = function(h, opts) {
  return !h || h.times.length >= opts.times || h.errors >= opts.errors;
};

var isSiteCompleted = function(s, opts) {
  return isHalfCompleted(s.on, opts) && isHalfCompleted(s.off, opts);
};

var notc = f => function() { return !f.apply(this, arguments); };

Object.prototype.defaults = function(def) {
  Object.keys(def).forEach(function(k) {
    if (this[k] === undefined)
      this[k] = def[k];
  });
};

exports.navigate = function(sites, opts, handler) {
  ["extraPrefs", "extraGlobals", "turnOff", "turnOn"] // TODO: finish
    .forEach(k => { handler[k] = handler[k] || () => undefined });
  handler.doOne = doOne;
  opts.defaults({
    times: 1,
    errors: 1,
    timeout: 10,
    loadDelay: 0,
    random: true,
    abTesting: false
  });

  handler.sites = sites;
  handler.site = null;
  handler.half = null;
  handler.opts = opts;

  if (sites.length === 0)
    return handler.end();
  
  // prevent save file dialogs
  prefs.set("browser.helperApps.alwaysAsk.force", false);
  prefs.set("browser.helperApps.neverAsk.saveToDisk", saveMime.join(","));
  prefs.set("browser.download.defaultFolder", "/tmp");
  handler.extraPrefs(prefs);

  addGlobals(function(w, cloner) {
    // prevent js dialogs
    w.alert = function() { };
    w.confirm = function() { return false; };
    w.prompt = function() { return null; };
    w.print = function() { return false; };
    w.__addEventListener = w.addEventListener;
    w.addEventListener = function(eventType, fun, bubble) {
    if (eventType.toLowerCase() !== "beforeunload")
      return w.__addEventListener(eventType, fun, bubble);
    };
    // store exception messages
    w.onerror = function(msg) {
      handler.half.jsErrors.push(msg);
    };
    handler.extraGlobals(w, cloner);
  });

  handler.doOne();
};

exports.prepareSite = function(site, opts) {
  if (typeof site === "string") {
    return {
      url: site,
      on: {times: [], netErrors: 0, jsErrors: []},
      off: opts.abTesting ? {times: [], netErrors: 0, jsErrors: []} : undefined
    };
  }
  return site;
}

var pick = function(sites, opts) {
  var shift = opts.random ? Math.floor(Math.random() * sites.length) : 0;
  for (var i = 0; i < sites.length; i++) {
    var site = sites[(shift + i) % sites.length];
    if (!isSiteCompleted(site, opts))
      return site;
  }
  return null;
};

var doOne = function() {
  var site = pick(this.sites, this.opts);
  if (!site)
    return this.end(this.sites);
  handler.site = site;

  var half;
  if (opts.abTesting) {
    var onOrOff = ["on", "off"].filter(k => !isHalfCompleted(site[k], opts)).pick();
    half = site[onOrOff];
    half === site.on ? (handler.turnOn()) : (handler.turnOff());
  } else {
    half = site.on;
  }
  handler.half = half;


  handler.beforeOpen();

  cookieManager.removeAll();

  var startTime, timeoutId;
  tabs.open({
    url: site.url,
    inNewWindow: false,
    onOpen: function(tab) {
      startTime = (new Date()).getTime();
      timeoutId = timers.setTimeout(function() {
        which.errors++;
        cbs.beforeClose && cbs.beforeClose(site, whichKey, tab, true);
        tab.close();
        doOne(sites, opts, cbs);
      }, opts.timeout * 1000);
    },
    onLoad: function(tab) {
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