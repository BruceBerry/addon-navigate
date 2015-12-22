# addon-navigate

Addon-SDK module to navigate the browser to a list of URLs, one after the other.
Use `new Handler(urls, options, callbacks)` to instantiate the navigator, then
call `handler.start()`.

Features supported out of the box through the `opts` parameter:

* `times`: Load the same site N times, recording load times and
  logging all js errors. (default=1)
* `errors`: give up visiting a site after N timeouts (default=1)
* `timeout`: number of seconds to wait for the load event before recording
  an error. (default=10)
* `loadDelay`: after the `load` event, wait another N seconds before performing
  further analysis and navigating to the next page. (default=0)
* `random`: if true, pick a new site at random. Otherwise, go sequentially.
  (default=true)
* `abTesting`: A/B testing support. Load the same site twice, turning a
  specific feature on and off (default=false)

New features can be added by defining optional callbacks on the handler object:

* `extraPrefs(prefs)`: use the `prefs` module from the addon-sdk to modify
  preferences before sites are visited.
* `extraGlobals(w, cloner)`: add properties on every site's global object before
  any javascript code runs. `cloner` is `Cu.cloneInto`.
* `extraProperties(site)`: add properties to the sites before they are
* `turnOn/turnOff()`: called during A/B testing to turn the feature on and off
  respectively.
* `beforeOpen()`: gives you a chance to modify a site object before it is
  loaded.

## Usage

    var {navigate} = require("addon-navigate");

    navigate(["http://www.google.com", ...], {
      times: 2,
      errors: 1,
      timeout: 10,
      loadDelay: 2,
      random: true,
      abtesting: true,
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