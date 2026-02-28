# MagicMirror² Module SDK Reference

Synthesised from the official MagicMirror² module development docs. Last fetched: 2026-02-28.
Source: https://docs.magicmirror.builders/module-development/

---

## 1. Module File Structure

```text
modules/
  MMM-Name/
    MMM-Name.js       ← required: main module file
    node_helper.js    ← optional: server-side helper
    MMM-Name.css      ← optional: styles
    public/           ← optional: browser-accessible static files at /MMM-Name/filename
    translations/     ← optional: i18n JSON files
```

- Module names must be **globally unique** across the MagicMirror ecosystem.
- Recommended naming convention: `MMM-MyModuleName`
- The `modules/` folder is git-ignored by the MagicMirror core, so upgrades won't overwrite custom modules.

### Registration

Every module file must call `Module.register()`:

```javascript
Module.register("MMM-Name", {
  requiresVersion: "2.1.0",   // minimum MM version; module won't load if user is older
  defaults: {                  // merged with user config; access via this.config.key
    myOption: "defaultValue",
  },
  // ... methods
});
```

---

## 2. Instance Properties

Available on `this` within any module method after initialisation:

| Property | Type | Description |
|---|---|---|
| `this.name` | String | Module name (as registered) |
| `this.identifier` | String | Unique instance identifier |
| `this.hidden` | Boolean | Current visibility state |
| `this.config` | Object | Merged `defaults` + user config from `config.js` |
| `this.data` | Object | Metadata: `classes`, `file`, `path`, `header`, `position` |

---

## 3. Lifecycle Methods

### `init()`
Called during instantiation. Rarely needs overriding.

### `loaded(callback)`
Called when module loads (v2.1.1+). **Must call `callback()` when complete.**
Subsequent modules have not yet loaded at this point.

### `start()`
Called when the system is ready to boot. The DOM has **not** been created yet.
Use this to initialise module-level properties and kick off timers or data fetching.

```javascript
start: function() {
  this.myData = [];
  this.sendSocketNotification("INIT", this.config); // send config to node_helper here
}
```

### `suspend()`
Called when the module is hidden via `module.hide()`. Use to pause timers.

### `resume()`
Called when the module is shown via `module.show()`. Use to restart timers.

---

## 4. Rendering

### `getDom()` → DOM Element
The primary rendering method. Called on initial load and after every `this.updateDom()`.
Must return a single DOM element.

```javascript
getDom: function() {
  const wrapper = document.createElement("div");
  wrapper.className = "my-module";
  wrapper.innerHTML = "Hello world";
  return wrapper;
}
```

### `getTemplate()` → String (alternative to getDom)
Returns path to a Nunjucks (`.njk`) template file. Used instead of `getDom()`.

```javascript
getTemplate: function() {
  return "MMM-Name.njk";
}
```

### `getTemplateData()` → Object
Provides the data object passed into the Nunjucks template.

```javascript
getTemplateData: function() {
  return { items: this.myData };
}
```

### `getHeader()` → String
Returns the module header string. Reference `this.data.header` to honour user config.

```javascript
getHeader: function() {
  return this.data.header;
}
```

### `this.updateDom(speed)`
Signals MagicMirror to call `getDom()` again and replace the current DOM.
- `speed` — animation duration in milliseconds (optional)
- Can also accept an options object: `{ speed: 300, animate: { in: "fadeIn", out: "fadeOut" } }`

```javascript
// After receiving new data:
this.updateDom(300);
```

---

## 5. Resource Loading

### `getStyles()` → Array\<String\>
Returns CSS files to load before the module renders. Use `this.file()` for module-relative paths.

```javascript
getStyles: function() {
  return [this.file("MMM-Name.css")];
}
```

### `getScripts()` → Array\<String\>
Returns JS files to load. Supports vendor files, module-relative paths, or external URLs.

```javascript
getScripts: function() {
  return [this.file("vendor/some-lib.js")];
}
```

### `getTranslations()` → Object | false
Returns a map of language code → translation file path. Return `false` if no translations needed.

```javascript
getTranslations: function() {
  return { en: "translations/en.json", nl: "translations/nl.json" };
}
```

### `this.file(filename)` → String
Resolves a path relative to the module's own directory.

---

## 6. Notifications (Module ↔ Module / Core)

### `notificationReceived(notification, payload, sender)`
Receives notifications broadcast by the core system or other modules.
`sender` is `undefined` for system-level notifications.

System notifications fired by MagicMirror core:

| Notification | When |
|---|---|
| `ALL_MODULES_STARTED` | All modules have started; `MM.getModules()` is now populated |
| `DOM_OBJECTS_CREATED` | All module DOMs have been created |
| `MODULE_DOM_CREATED` | This module's own DOM has been created |

```javascript
notificationReceived: function(notification, payload, sender) {
  if (notification === "ALL_MODULES_STARTED") {
    // safe to interact with other modules
  }
}
```

### `this.sendNotification(notification, payload)`
Broadcasts a notification to all other modules (not to node_helper).

---

## 7. Socket Communication (Module ↔ node_helper)

The socket channel is the only way for the frontend module and backend node_helper to communicate.

### Frontend → Backend

```javascript
this.sendSocketNotification("MY_NOTIFICATION", { key: "value" });
```

The socket connection is established after the **first** message is sent from the frontend.
Always send config to the helper in `start()`.

### Backend → Frontend

In `node_helper.js`:
```javascript
this.sendSocketNotification("MY_RESPONSE", { data: result });
```

This broadcasts to **all instances** of the module type, not a single instance.

### Frontend receives

```javascript
socketNotificationReceived: function(notification, payload) {
  if (notification === "MY_RESPONSE") {
    this.myData = payload.data;
    this.updateDom();
  }
}
```

**Important:** Since one node_helper serves all instances of a module, include
an identifier (e.g. `this.identifier`) in payloads if you need to target a specific instance.

---

## 8. node_helper API

`node_helper.js` runs in Node.js on the server side. Only one instance exists per module type.

```javascript
const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  // properties and methods
});
```

### Properties

| Property | Description |
|---|---|
| `this.name` | Module name |
| `this.path` | Absolute path to the module directory |
| `this.expressApp` | Express.js instance — add custom HTTP routes here |
| `this.io` | Socket.IO instance (direct socket access; rarely needed) |

### Lifecycle

```javascript
start: function() {
  // Called on system boot. Initialise DB connections, cron jobs, etc.
  this.db = openDatabase();
},

stop: function() {
  // Called on SIGINT shutdown. ALWAYS close DB connections here.
  this.db.close();
}
```

### Receiving from frontend

```javascript
socketNotificationReceived: function(notification, payload) {
  if (notification === "INIT") {
    this.config = payload; // store config sent from module start()
  }
  if (notification === "TOGGLE_CHORE") {
    // handle DB write, send response back
    this.sendSocketNotification("STATE_UPDATE", newState);
  }
}
```

### No default config
The node_helper has **no access** to `config.js`. The frontend module must explicitly
send its config via socket notification (typically in `start()`).

### Native Node modules
If you `npm install` a package with native bindings (e.g. `better-sqlite3`),
run `@electron/rebuild` after install for Electron compatibility.

### Custom Express routes
```javascript
start: function() {
  this.expressApp.get("/MMM-Name/data", (req, res) => {
    res.json({ ok: true });
  });
}
```
Static files in `public/` are served automatically at `/MMM-Name/filename`.

---

## 9. Visibility

### `this.hide(speed, callback, options)`
Hides the module.
- `speed` — animation duration in ms
- `callback` — called when animation completes
- `options.lockString` — string key to lock visibility (prevent other show calls)
- `options.animate` — animation style

### `this.show(speed, callback, options)`
Shows the module.
- `options.lockString` — release a specific lock
- `options.force: true` — override all locks
- `options.onError` — called if show fails

---

## 10. Module Selection (MM global)

Available in the browser context only. Safe to use after `ALL_MODULES_STARTED`.

```javascript
MM.getModules()                        // all loaded module instances (Array)
  .withClass("classname")              // filter by class name (string or array)
  .exceptWithClass("classname")        // exclude by class name
  .exceptModule(this)                  // exclude a specific instance
  .enumerate(function(module) { ... }) // iterate over results
```

---

## 11. Translation

### In module JS

```javascript
// getTranslations() must return a path map first
this.translate("MY_KEY")
this.translate("GREETING", { name: "Alice" }) // variable substitution for word-order flexibility
```

Fallback order: user module translation → user core translation → fallback module translation → fallback core translation → key itself.

### In Nunjucks templates

```njk
{{ "MY_KEY" | translate }}
```

### Custom Nunjucks filters

```javascript
start: function() {
  this.nunjucksEnvironment().addFilter("myFilter", function(str) {
    return str.toUpperCase();
  });
}
```

---

## 12. Logger

A thin wrapper around the browser/Node `console.*` methods.

### Frontend (browser context)
Available globally as `Log` — no import needed.

```javascript
Log.log("debug message");
Log.info("informational");
Log.warn("warning");
Log.error("something went wrong");
```

### Backend (node_helper)
Must be explicitly required:

```javascript
const Log = require("logger");
Log.info("[MMM-Name] Helper started");
```

**Note:** Frontend logs appear in the **Electron/browser developer console**, not the
terminal. Backend logs appear in the terminal where MagicMirror was launched.

---

## 13. Key Patterns for MMM-Chores-Alt

### Startup flow
```text
module start()
  → sendSocketNotification("INIT", this.config)
    → node_helper stores config, opens DB, schedules midnight reset
      → sendSocketNotification("STATE", fullState)
        → module stores state, updateDom()
```

### User taps a chore
```text
DOM click handler
  → sendSocketNotification("TOGGLE_CHORE", { childId, choreId, date })
    → node_helper writes to DB
      → sendSocketNotification("STATE", updatedState)
        → module stores state, updateDom()
```

### Parent redeems tally
```text
DOM "Redeem" button
  → prompt for PIN (DOM-level)
  → sendSocketNotification("REDEEM", { childId, pin })
    → node_helper verifies PIN, writes redemption record, zeroes tally
      → sendSocketNotification("STATE", updatedState)
        → module stores state, updateDom()
```

### Midnight reset (node_helper)
```text
node-cron job fires at 00:00
  → node_helper clears today's completions in DB
  → sendSocketNotification("STATE", updatedState)
    → module stores state, updateDom()
```
