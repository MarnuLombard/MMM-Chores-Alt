# MagicMirror² SDK - Agent Guide

This file is the entry point for agents working in this repo who need MagicMirror
SDK knowledge. It points to the canonical extracted docs in
[`magicmirror-sdk/`](./magicmirror-sdk/) and summarises the parts that matter for
this codebase.

The raw markdown under `magicmirror-sdk/` was fetched verbatim from
[`MagicMirrorOrg/MagicMirror-Documentation`](https://github.com/MagicMirrorOrg/MagicMirror-Documentation/tree/master/module-development)
on 2026-05-14. It is the canonical, current source. Live rendered version:
<https://docs.magicmirror.builders/module-development/>.

When a fact in this file disagrees with the raw extracted files, trust the raw
files. When the raw files disagree with the upstream site, re-fetch.

---

## How to use this directory

### 1. Read this file first (you are here)

It tells you which extracted doc to open for the task at hand and lists the
project-specific gotchas that are not in the upstream docs.

### 2. Open the specific extracted doc you need

Files are named after the upstream pages and contain the full canonical text:

| File | Read it when you need to ... |
|---|---|
| [`magicmirror-sdk/introduction.md`](./magicmirror-sdk/introduction.md) | Understand folder layout, `public/` serving, the empty-stub `node_helper.js` pattern. |
| [`magicmirror-sdk/core-module-file.md`](./magicmirror-sdk/core-module-file.md) | Look up any frontend module method - `Module.register`, lifecycle (`init`/`start`/`suspend`/`resume`), `getDom`/`getTemplate`/`getHeader`, `notificationReceived`, `socketNotificationReceived`, `updateDom`, `sendNotification`, `sendSocketNotification`, `hide`/`show`, visibility locking, `translate`. This is the largest and most-used reference. |
| [`magicmirror-sdk/node-helper.md`](./magicmirror-sdk/node-helper.md) | Work on `node_helper.js` - `NodeHelper.create`, `start`/`stop`/`loaded`, `socketNotificationReceived`, `this.expressApp`, `this.io`, native-module rebuild. |
| [`magicmirror-sdk/notifications.md`](./magicmirror-sdk/notifications.md) | Look up system notifications (`ALL_MODULES_STARTED`, `DOM_OBJECTS_CREATED`, `MODULE_DOM_CREATED`, `MODULE_DOM_UPDATED`) and default-module notifications (alert, calendar, newsfeed). |
| [`magicmirror-sdk/rendering.md`](./magicmirror-sdk/rendering.md) | Choose between `getDom` and Nunjucks templates, add Nunjucks filters via `this.nunjucksEnvironment()`. |
| [`magicmirror-sdk/helper-methods.md`](./magicmirror-sdk/helper-methods.md) | Use the `MM` global - `MM.getModules().withClass(...).exceptModule(...).enumerate(...)` to drive other modules. |
| [`magicmirror-sdk/logger.md`](./magicmirror-sdk/logger.md) | Confirm logger usage (`Log` is global on frontend, `require("logger")` in node_helper). |
| [`magicmirror-sdk/documentation.md`](./magicmirror-sdk/documentation.md) | (Human-facing README writing tips. Agents can skip this one unless asked to author a README.) |

### 3. Re-fetch if upstream may have changed

```sh
BASE=https://raw.githubusercontent.com/MagicMirrorOrg/MagicMirror-Documentation/master/module-development
for f in introduction core-module-file node-helper notifications rendering helper-methods logger documentation; do
  curl -fsSL "$BASE/$f.md" -o "docs/magicmirror-sdk/$f.md"
done
```

A 9th upstream file `weather-provider.md` exists but is not relevant to this
project (weather-provider plugin API only) and is intentionally not mirrored.

---

## Task -> doc mapping (quick reference)

- "Add a new frontend method / change rendering" -> `core-module-file.md` + `rendering.md`
- "Send data between module and node_helper" -> `core-module-file.md` (`sendSocketNotification`, `socketNotificationReceived`) + `node-helper.md`
- "Coordinate with other modules" -> `notifications.md` + `helper-methods.md`
- "Touch DB / cron / file system in node_helper" -> `node-helper.md`
- "Add an HTTP endpoint" -> `node-helper.md` (`this.expressApp`)
- "Hide/show modules, lockStrings" -> `core-module-file.md` (Visibility locking section)
- "Translations / i18n" -> `core-module-file.md` (`translate`) + `rendering.md` (Nunjucks `translate` filter)

---

## Concentrated API cheatsheet

Use this for instant recall; open the raw doc for full text.

### Frontend module skeleton

```js
Module.register("MMM-Name", {
  requiresVersion: "2.25.0",
  defaults: { /* merged into this.config */ },

  start() {                    // can be async; system awaits Promise.allSettled
    this.state = null;
    this.sendSocketNotification("INIT", this.config); // helper has no other way to get config
  },

  getDom() { /* return a single Element */ },
  // OR: getTemplate() + getTemplateData()

  getStyles() { return [this.file("MMM-Name.css")]; },
  getScripts() { return []; },
  getTranslations() { return false; },

  notificationReceived(notification, payload, sender) { /* core + other modules */ },
  socketNotificationReceived(notification, payload) { /* from this module's helper */ },

  suspend() { /* pause timers when hidden */ },
  resume()  { /* restart timers when shown */ },
});
```

### Node helper skeleton

```js
const NodeHelper = require("node_helper");
const Log = require("logger"); // must require explicitly in node_helper

module.exports = NodeHelper.create({
  start() { /* open DB, schedule cron */ },
  stop()  { /* close DB, kill subprocesses - called on SIGINT */ },
  socketNotificationReceived(notification, payload) {
    if (notification === "INIT") this.config = payload;
    // ...
    this.sendSocketNotification("RESPONSE", data); // broadcasts to ALL instances of this module type
  },
});
```

### Instance properties

Frontend `this`: `name`, `identifier`, `hidden`, `config`, `data` (`{classes, file, path, header, position}`).
Helper `this`: `name`, `path`, `expressApp`, `io`.

### System notifications (frontend, via `notificationReceived`)

| Name | Fires when |
|---|---|
| `ALL_MODULES_STARTED` | All modules started; `MM.getModules()` is populated. |
| `DOM_OBJECTS_CREATED` | All module DOMs created; safe to call `hide`/`show`. |
| `MODULE_DOM_CREATED` | This module's DOM is ready. |
| `MODULE_DOM_UPDATED` | This module's DOM was re-rendered after `updateDom()`. Only fires if content actually changed. |

### `updateDom` options (v2.25.0+)

```js
this.updateDom({ speed: 1000, animate: { in: "backInDown", out: "backOutUp" } });
```

### `MM.getModules()` chain

```js
MM.getModules()
  .withClass("classname")
  .exceptWithClass("classname")
  .exceptModule(this)
  .enumerate(module => { /* ... */ });
```
Returns `[]` until `ALL_MODULES_STARTED`.

### Hide/show with locks

```js
moduleA.hide(0, { lockString: this.identifier });
moduleA.show(0, { lockString: this.identifier });
moduleA.show(0, { force: true }); // wipes all locks - use sparingly
```

---

## Gotchas not derivable from the docs

These are project-specific or upstream-but-buried facts that bite agents
repeatedly. Internalise them.

### 1. One node_helper per module type, not per instance

If two configs use the same module type, there is still only one helper. Helper
broadcasts via `sendSocketNotification` reach **every** module instance. If you
need to target one instance, include `this.identifier` in the payload from the
frontend and filter on it in the helper / frontend.

This project currently runs one instance, so we send `STATE` without filtering -
but if multi-instance support is ever added, every helper -> module message must
be tagged.

### 2. Helper has no access to `config.js`

The helper is initialised independently of any user config. The frontend must
send the config via `sendSocketNotification("INIT", this.config)` in `start()`.
This project does that in `src/frontend/Frontend.ts`.

Side effect: when the frontend reloads (browser refresh), `start()` runs again
and `INIT` is sent again. The helper must guard against re-opening DB handles
or re-scheduling cron - this project does that explicitly in
`src/backend/Backend.ts`.

### 3. Socket connection is lazy

The socket from module -> helper opens only after the first
`sendSocketNotification` from the frontend. A helper that wants to push state
on boot must wait for the frontend's first message before sending anything.

### 4. `MM.getModules()` is empty before `ALL_MODULES_STARTED`

Do not call it in `start()`. Wait for the notification.

### 5. `hide`/`show` no-op before `DOM_OBJECTS_CREATED`

Also: if a module has no `position` defined, it may have no DOM, and
`suspend`/`resume` won't fire for it. Not an issue for this project (chores row
has a position).

### 6. Frontend `Log` is global; helper `Log` must be required

```js
// frontend
Log.info("msg");
// node_helper
const Log = require("logger");
Log.info("msg");
```
Frontend logs land in the Electron/browser devtools console, not the terminal
that launched MagicMirror.

### 7. Native modules need rebuild for Electron

`better-sqlite3` is a native module. The `postinstall` script must run
`@electron/rebuild` against MagicMirror's pinned Electron. See `package.json`
in this repo - the script intentionally exits 0 with a warning when run outside
a MagicMirror parent so test runs in a standalone clone don't break.

### 8. `public/` requires a `node_helper.js`

Files under `MMM-Name/public/` are served at `/MMM-Name/filename` only if
`node_helper.js` exists. If you need static file serving but no helper logic,
an empty stub is required:
```js
const NodeHelper = require("node_helper");
module.exports = NodeHelper.create({});
```

### 9. `start()` may be async (v2 docs)

The upstream docs now note `start()` can be `async` or return a `Promise`. The
core uses `Promise.allSettled` over all modules' `start()` results before
proceeding to DOM creation. Useful when you must wait for custom elements or
async resource registration.

### 10. Best practice: use `new Date(Date.now())` not `new Date()`

Upstream docs flag this in their general advice - lets debugging tooling
override `Date.now`. Not a hard rule for this project, but if you write new
date-handling code, follow it.

---

## When the user asks "where is X in the SDK?"

1. Check the **task -> doc mapping** above.
2. If not found, grep the extracted files:
   ```sh
   rg -i "<keyword>" docs/magicmirror-sdk/
   ```
3. If still not found, search the live docs at <https://docs.magicmirror.builders/>
   and the upstream repo `MagicMirrorOrg/MagicMirror-Documentation`.
4. The forum at <https://forum.magicmirror.builders/> is the next-best source
   for behaviours not covered in the docs (e.g. multi-instance notification
   semantics). Treat forum answers as community knowledge - verify against code
   in `MagicMirrorOrg/MagicMirror` before relying on them.

---

## Project-specific data-flow patterns

These are documented here because they encode the contract between
`src/frontend/` and `src/backend/` in this repo. Not part of the SDK; included
for fast agent onboarding.

### Boot

```text
Frontend.start()
  -> sendSocketNotification("INIT", this.config)
    -> Backend opens DB, schedules midnight cron, builds state
      -> sendSocketNotification("STATE", fullState)
        -> Frontend stores state, updateDom()
```

### Tap a chore

```text
Frontend chore-button click
  -> sendSocketNotification("TOGGLE_CHORE", { childId, choreId })
    -> Backend writes/deletes completion for today's date
      -> sendSocketNotification("STATE", updatedState)
        -> Frontend updateDom()
```
Backend determines the date (no `todayStr` from frontend).

### Redeem tally

```text
Frontend "Redeem" button -> PIN modal (DOM-level)
  -> sendSocketNotification("REDEEM", { childId, pin })
    -> Backend verifies PIN (plain-text compare), writes redemption
      -> sendSocketNotification("STATE", updatedState)
        -> Frontend updateDom()
```

### Midnight reset

```text
node-cron 00:00
  -> Backend rebuilds state (today's completions are now empty because date changed)
    -> sendSocketNotification("STATE", updatedState)
      -> Frontend updateDom()
```
Completions are never deleted - the daily reset is implicit via the date change.
