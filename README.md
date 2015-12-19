# addon-navigate

Addon-SDK module to navigate the browser to a list of URLs, one after the
other. It supports A/B testing and loading the site multiple times to get
average loading times. It can be used for other analyses through the optional
callbacks provided.

## Usage

    var {navigate} = requrie("addon-navigate");

    navigate(["http://www.google.com", ...], {
      times: 2, // # of times to load each site
      errors: 1, // # of times to retry if the load times out
      random: true, // pick a site randomly or go in order.
      doOff: true, // A/B testing, loads the site another `times` # of times with another configuration
      timeout: 10, // maximum time to wait for the site to load
      loadDelay: 2 // time to wait after the load event for further analysis
    }, {
      end: function(sites) { },
      extraPrefs: function(prefs) {
        // supplies the prefs addon-sdk module
      },
      extraGlobals: function(w, cloner) {
        // supplies an unwrapped `window` object and Cu.cloneInto
        // change the javascript environment before any javascript code runs
      },
      turnOn: function() { /* turn on the feature you are A/B testing */ },
      turnOff: function() { /* these are called every time */ },
      beforeOpen: function(site, onOrOff) {
        // gives you a chance to modify the site before it is loaded.
        // the second argument is either "on" or "off"
      },
      beforeClose: function(site, onOrOff, tab, isTimeout) {
        // gives you a chance to modify the page before it is closed
        // TODO: pass the low-level tab browser
      }
    });