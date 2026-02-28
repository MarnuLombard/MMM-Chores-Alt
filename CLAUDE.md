# MMM-Chores-Alt

## Project

A MagicMirror² module for tracking children's daily chores on a touchscreen display.
Each child has assigned chores they tap to check off; a running tally of earned points
accumulates across days and is reset by a parent PIN when redeemed.

---

## Feature Spec

### Children & Chores
- N children configured with a name, avatar/colour, and list of daily chores
- Each chore has a label (optional), an icon (emoji string or image path), and a point value
- Configuration defined in MagicMirror `config.js` (standard approach; no separate JSON file)

### Chore Icon Config
Children are pre-reading age — every chore button must have a recognisable visual.
The `icon` field supports three forms; rendering logic auto-detects the type:

```javascript
// Emoji (string with no / or .)
{ id: "make-bed",     label: "Make Bed",     icon: "🛏️",                                    points: 1 },
// Module-relative image path
{ id: "brush-teeth",  label: "Brush Teeth",  icon: "/modules/MMM-Chores-Alt/icons/teeth.png", points: 1 },
// External/absolute URL
{ id: "tidy-room",    label: "Tidy Room",    icon: "https://example.com/icons/room.png",       points: 1 },
```

Rendering rule: if `icon` contains `/` or `.` → render as `<img src="...">`;
otherwise render as a text node (emoji or plain text).
`label` is optional; omit it if the icon is self-explanatory for the child.

### Display
- One panel per child: name, chore list (large tap buttons), cumulative tally
- Completed chores are visually distinct (e.g. greyed out + checkmark overlay)
- Buttons are large enough for young children — see UI/Layout Spec below

### Interaction (touchscreen)
- Tap a chore to toggle complete ↔ incomplete (accidental taps are reversible)
- Tally updates in real time on each toggle

### Daily Reset
- node_helper runs a cron job at midnight: clears today's completions
- Cumulative tally is **preserved** across resets; only per-day completion status clears

### Tally Redemption
- "Redeem" button triggers a parent PIN prompt
- Correct PIN → child's tally resets to 0, redemption recorded in DB

### Data (SQLite)
- Tables: `children`, `chores`, `completions` (date + child_id + chore_id), `redemptions`
- node_helper is the **sole** DB owner; frontend never accesses the DB directly

### UI / Layout Spec

**Target display:** 1920×1080, 2 children, 5 chores each, touchscreen.

**Panel layout** (2 panels side by side, full width):
- Each panel: ~940px wide × ~980px tall (accounting for MM chrome/padding)
- Panel header (child name + avatar): ~80px tall
- Tally row: ~60px tall
- Chore area: remaining ~840px ÷ 5 chores = **~168px per chore button**

**Chore button sizing targets:**
- Min height: `120px` (hard floor); target `~160px`
- Icon/emoji: `80px` font-size for emoji; `80×80px` for `<img>`
- Label text (if present): `24px`, below the icon, optional display
- Touch target must cover the full button area (no small click zone)

**CSS sizing approach:** Use CSS custom properties so values can be overridden
via the `config` object if the module is deployed on a different screen:
```css
:root {
  --chores-button-height: 160px;
  --chores-icon-size: 80px;
  --chores-label-size: 24px;
  --chores-panel-gap: 16px;
}
```

**Completed state:** dim opacity to `0.4` + overlay a ✅ badge; do NOT remove the
button (child must be able to un-tap).

---

## Architecture

```text
MMM-Chores-Alt/
  MMM-Chores-Alt.js   ← MagicMirror frontend module (browser)
  node_helper.js      ← Node.js backend: SQLite, cron, socket handler
  MMM-Chores-Alt.css  ← Styles
  docs/
    magicmirror-sdk.md  ← Full SDK reference (see below)
```

Phase 2 scaffolding complete. All template files renamed and replaced.

---

## Tech Stack

- **MagicMirror² module SDK** — `Module.register()`, `NodeHelper.create()`
- **better-sqlite3** — synchronous SQLite for node_helper
- **node-cron** (or `node-schedule`) — midnight daily reset job
- **Vanilla JS / DOM** — frontend rendering via `getDom()`, no framework
- No frontend build step; plain JS runs directly in Electron/browser

---

## MagicMirror SDK — Key Conventions

### Module registration (MMM-Chores-Alt.js)
```javascript
Module.register("MMM-Chores-Alt", {
  requiresVersion: "2.25.0",
  defaults: { children: [], parentPin: "0000" },
  start() {
    this.state = null;
    this.sendSocketNotification("INIT", this.config); // always send config in start()
  },
  getDom() { /* return a DOM element */ },
  socketNotificationReceived(notification, payload) {
    if (notification === "STATE") { this.state = payload; this.updateDom(); }
  },
  getStyles() { return [this.file("MMM-Chores-Alt.css")]; },
});
```

### node_helper (node_helper.js)
```javascript
const NodeHelper = require("node_helper");
const Log = require("logger"); // must require explicitly in node_helper
module.exports = NodeHelper.create({
  start() { /* open DB, schedule cron */ },
  stop() { /* close DB — called on SIGINT */ },
  async socketNotificationReceived(notification, payload) {
    if (notification === "INIT") { this.config = payload; /* setup */ }
  },
});
```

### Triggering a re-render
```javascript
this.updateDom();          // immediate
this.updateDom(300);       // 300ms animation
```

### Logging
- Frontend: `Log.info(...)`, `Log.warn(...)`, `Log.error(...)` (global, no import)
- Backend: `const Log = require("logger");` then same methods
- Frontend logs appear in the **browser/Electron console**, not the terminal

### Key constraint
node_helper has **no access** to `config.js` — the module must send its config
via `sendSocketNotification("INIT", this.config)` in `start()`.

One node_helper instance serves **all** instances of the module type.

---

## Full SDK Reference

See [`docs/magicmirror-sdk.md`](docs/magicmirror-sdk.md) for:
- All lifecycle methods (`init`, `loaded`, `start`, `suspend`, `resume`)
- All rendering methods (`getDom`, `getTemplate`, `getTemplateData`, `getHeader`)
- Resource loading (`getStyles`, `getScripts`, `getTranslations`)
- Notification system (module ↔ module, module ↔ node_helper)
- Visibility control (`hide`, `show`, lock strings)
- `MM.getModules()` selection API
- Translation system
- End-to-end data flow patterns for this module
