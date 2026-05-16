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
- Single horizontal strip across the screen, max 160px tall
- Grouped sections: each child's name, chore buttons, and tally sit inline in one row
- Completed chores are visually distinct (greyed out + checkmark overlay)
- Buttons are large enough for young children — see UI/Layout Spec below

### Interaction (touchscreen)
- Tap a chore to toggle complete ↔ incomplete (accidental taps are reversible)
- Tally updates in real time on each toggle

### Tally Display Format
- `displayFormat: { prefix: string, suffix: string }` on the module config
- Default: `{ prefix: "", suffix: "pts" }` (e.g. `15pts`)
- For pocket-money mode: `{ prefix: "$", suffix: "" }` paired with fractional
  `points` values like `0.10` per chore (e.g. `$1.50`)
- Decimals auto-detected: integer tallies render plain, fractional tallies
  render with 2dp (and 2dp rounding tames `0.1 + 0.2 = 0.30000000000000004`)
- Storage: `redemptions.amount` is `REAL`, so decimal redemption amounts
  round-trip exactly

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

**Layout** (single horizontal strip, full width, max 160px tall):
```text
┌─────────────────────────────────────────────────────────────────┐
│ Alice  🛏️  🦷  👕  🧹  📚  15pts │ Bob  🛏️  🦷  👕  🧹  📚  8pts │
└─────────────────────────────────────────────────────────────────┘
```
- One flex row containing grouped sections (one per child)
- Each section: child name (colored), chore buttons (inline), tally + redeem
- Sections separated by a subtle divider; child colour used as accent

**Chore button sizing targets:**
- Max row height: `160px`; buttons fill available height
- Icon/emoji: `64px` font-size for emoji; `64×64px` for `<img>`
- Label text hidden by default (space constrained); shown on hover/focus if present
- Touch target must cover the full button area (no small click zone)

**CSS sizing approach:** Use CSS custom properties so values can be overridden
via the `config` object if the module is deployed on a different screen:
```css
:root {
  --chores-row-height: 160px;
  --chores-icon-size: 64px;
  --chores-button-gap: 8px;
  --chores-section-gap: 16px;
}
```

**Completed state:** dim opacity to `0.4` + overlay a ✅ badge; do NOT remove the
button (child must be able to un-tap).

---

## Architecture

```text
MMM-Chores-Alt/
  MMM-Chores-Alt.js          ← built frontend (UMD; committed)
  MMM-Chores-Alt.js.map      ← source-map (committed)
  node_helper.js             ← built backend (CJS; committed)
  node_helper.js.map         ← source-map (committed)
  MMM-Chores-Alt.css         ← styles
  src/
    frontend/  Frontend.ts (entry), render, stateDiff, stateReactor,
               pin, delight, icon
    backend/   index.ts (entry), Backend, repository, tally, stateBuilder,
               dateUtils
    constants/ SocketNotifications
    types/     Config, State, Domain, Effects
  __tests__/unit/{frontend,backend}/
  __mocks__/   logger, node_helper, Module
  docs/
    magicmirror-sdk.md
    features/typescript-conversion.spec.md
```

Source lives in `src/`; the committed `MMM-Chores-Alt.js` and `node_helper.js`
are build artefacts - run `npm run build` after source changes.

---

## Tech Stack

- **MagicMirror² module SDK** - `Module.register()`, `NodeHelper.create()`
- **TypeScript** compiled by Vite to UMD (frontend) and CJS (backend); strict
  types from `src/types/`
- **Vitest** + happy-dom for unit tests in `__tests__/unit/`
- **better-sqlite3** - synchronous SQLite for the backend
- **node-cron** - midnight daily reset job
- Frontend rendering via `getDom()`; no UI framework

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

## Testing

- Run via `npm test` (Vitest, `happy-dom` environment).
- `repository.test.ts` uses real in-memory SQLite (`new ChoresRepository(':memory:')`),
  not a mock. `Backend.test.ts` exercises the same in-memory repository through
  `createBackendSpec`; only `sendSocketNotification` is mocked.
- `__tests__/setup.ts` stubs `AudioContext`, `Log`, and `Module` globals before
  any source import.
- No coverage tooling and no thresholds - intentional.

## Build & Install

- `npm install` triggers `postinstall` -> `@electron/rebuild` against
  MagicMirror's pinned Electron. The script exits 0 with a warning when run
  outside a MagicMirror parent (standalone clone for tests).
- `.npmrc` sets `optional=true` so the lockfile lists all platform variants of
  optional deps. Use `npm install`, not `npm ci --omit=optional`.
- `npm run build` runs Vite twice: frontend (UMD, externalises `logger`) then
  backend (CJS, externalises `better-sqlite3`, `node-cron`, `node_helper`,
  `logger`, `path`, `fs`).

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
