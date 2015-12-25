# addon-navigate

Addon-SDK module to navigate the browser to a list of URLs, one after the other.
Use `new Handler(urls, options, callbacks)` to instantiate the navigator, then
call `handler.start()`.

Features supported out of the box through options:

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

The behavior can be modified by defining optional callbacks on the handler
object:

* `extraPrefs(prefs)`: use the `prefs` module to modify preferences before
  the navigation is started.
* `extraGlobals(w, cloneF)`: for each site, add properties on every site's
  global object (`w`) before any javascript code runs.
* `extraProperties(site)`: add properties to a site before visiting it and
  recording any statistic, called only once.
* `beforeOpen()`: modify a site object right before the site is visited, called
  each time.
* `beforeClose(tab)`: modify a site object right before the page is closed. this
  gives you access to the page (TODO: give something better than `tab`) for
  examination.
* `turnOn/turnOff()`: called during A/B testing to turn the feature on and off
  respectively.
* `end()`: called when all sites have been visited.

These methods have access to the following instance properties:

* `this.sites`: the current state of all sites.
* `this.site`: the current site being visited.
* `this.half`: the current site.(on|off) being visited. If `abTesting` is false,
  this will always be equal to `this.site.on`.

Note that these are not always defined. For example, `this.site` is not
available in `end()`.

## Usage

    var {navigate} = require("addon-navigate");
    var prefs = require("sdk/preferences/service");

    var n = new Navigator(["http://www.google.com", ...], {
      times: 10,
      errors: 4,
      loadDelay: 2,
      random: false,
      abtesting: true,
    }, {
      end: function() {
        console.log("result", this.sites);
      },
      extraGlobals: function(w, cloneF) {
        // simple properties can be defined directly
        w.__debug = true;
        // cloneF is a shorthand to define functions using Cu.cloneInto
        cloneF(msg => console.log(msg), w, "alert");
      },
      turnOn: function() {
        prefs.set("my.feature.enabled", true);
      },
      turnOff: function() {
        prefs.set("my.feature.enabled", false);
      },
    });
