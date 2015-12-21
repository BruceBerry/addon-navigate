# addon-navigate

Addon-SDK module to navigate the browser to a list of URLs, one after the
other. Use `navigate` to navigate to a new list of sites, or resuming an
existing navigation.

Features supported out of the box through the `opts` parameter:

* `times`: Load the same site N times, calculating the average load time and
  logging all js errors. (default=1)
* `errors`: give up visiting a site after N timeouts (default=1)
* `timeout`: number of seconds before considering the navigation a network
  error. (default=10)
* `loadDelay`: after the `load` event, wait another N seconds before performing
  further analysis and navigating to the next page. (default=0)
* `random`: pick a new site at random or go sequentially. (default=true)
* `abTesting`: A/B Testing: load the same site twice, turning a specific feature on and off (default=false)

It supports A/B testing and loading the site multiple times to get
average loading times. It can be used for other analyses through the optional
callbacks provided.

## Usage

    var {navigate} = require("addon-navigate");

    navigate(["http://www.google.com", ...], {
      times: 2,
      errors: 1,
      timeout: 10,
      loadDelay: 2,
      random: true, // pick a site randomly or go in order.
      abtesting: true, // A/B testing, loads the site another `times` # of times with another configuration
    }, {
      end: function(sites) { /* save data */ },
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