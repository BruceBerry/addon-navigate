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



var Navigator = exports.Navigator = function(sites, opts, fns) {
  // prototype chain is really messy
  var n = Object.create(fns);
  Object.assign(n, nproto);
  var api = [
    "extraPrefs", "extraGlobals", "extraProperties",
    "turnOff", "turnOn", "beforeOpen", "beforeClose",
    "end"
  ];
  api.forEach(k => { if (!fns[k]) n[k] = () => undefined; });
  n.opts = Object.assign({
    times: 1,
    errors: 1,
    timeout: 10,
    loadDelay: 0,
    random: true,
    abTesting: false
  }, opts),
  n.sites = sites.map(n.prepareSite.bind(n));
  n.site = null;
  n.half = null;
  return n;
};

var nproto = {
  start: function() {
    
    // prevent save file dialogs
    prefs.set("browser.helperApps.alwaysAsk.force", false);
    prefs.set("browser.helperApps.neverAsk.saveToDisk", saveMime.join(","));
    prefs.set("browser.download.defaultFolder", "/tmp");
    this.extraPrefs(prefs);

    addGlobals((w, cloner) => {
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
      w.onerror = msg => {
        this.half.jsErrors.push(msg);
      };
      this.extraGlobals(w, cloner);
    });

    this.doOne();
  },
  prepareSite: function(site) {
    if (typeof site === "string") {
      site = {
        url: site,
        on: {times: [], netErrors: 0, jsErrors: []},
        off: this.opts.abTesting ? {times: [], netErrors: 0, jsErrors: []} : undefined
      };
      this.extraProperties(site);
      return site;
    }
    return site;
  },
  pick: function() {
    var shift = this.opts.random ? Math.floor(Math.random() * this.sites.length) : 0;
    for (var i = 0; i < this.sites.length; i++) {
      var site = this.sites[(shift + i) % this.sites.length];
      if (!isSiteCompleted(site, this.opts))
        return site;
    }
    return null;
  },
  doOne: function() {
    this.site = this.pick();
    if (!this.site)
      return this.end();

    if (this.opts.abTesting) {
      var onOrOff = ["on", "off"].filter(k => !isHalfCompleted(this.site[k], this.opts)).pick();
      this.half = this.site[onOrOff];
      if (this.half === this.site.on)
        this.turnOn();
      else
        this.turnOff();
    } else {
      this.half = this.site.on;
    }

    this.beforeOpen();

    cookieManager.removeAll();

    var startTime, timeoutId;
    tabs.open({
      url: this.site.url,
      inNewWindow: false,
      onOpen: tab => {
        startTime = (new Date()).getTime();
        timeoutId = timers.setTimeout(() => {
          this.half.errors++;
          this.beforeClose(tab, true);
          tab.close();
          this.doOne();
        }, this.opts.timeout * 1000);
      },
      onLoad: tab => {
        timers.clearTimeout(timeoutId);
        var endTime = (new Date()).getTime();
        this.half.times.push(endTime - startTime);

        timers.setTimeout(() => {
          this.beforeClose(tab, false);
          tab.close();
          this.doOne();
        }, this.opts.loadDelay * 1000);
      }
    });
  }
};