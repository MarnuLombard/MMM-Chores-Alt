# TypeScript Conversion + Unit Testability

Phase that converts MMM-Chores-Alt from plain JS to a TypeScript codebase compiled with
Vite, refactored for unit testability with Vitest. Patterned on
[ismarslomic/MMM-Hello-World-Ts](https://github.com/ismarslomic/MMM-Hello-World-Ts) but
deliberately diverges where its choices conflict with this project's constraints (Vite vs Rollup,
Vitest vs Jest, no Husky/lint-staged/CI, no e2e, getDom over Nunjucks).

---

## 1. Goals

- All source code authored in `src/**/*.ts` with strict TypeScript.
- Two compiled artefacts at the repo root (MagicMirror entry-point convention):
  - `MMM-Chores-Alt.js` (UMD, browser, externalises `logger`)
  - `node_helper.js` (CJS, Node, externalises `node_helper`, `logger`, `better-sqlite3`, `node-cron`)
- Both compiled artefacts and their `.js.map` source-maps are committed to git.
- Vitest unit tests cover the refactored backend (pure functions + thin wrapper) and the
  frontend's pure logic (state-diff, reactor effects, PIN keypad reducer, icon detection).
- `npm install` succeeds on macOS, Linux, and the Raspberry Pi MagicMirror host without the
  package-lock pinning a single platform's native binary.
- Re-INIT is idempotent: sending `INIT` twice does not open a second SQLite handle.

## 2. Non-goals

- No e2e tests, no Cypress, no Playwright.
- No CI workflows (no `.github/workflows/*`, no `eslint-results.sarif`, no `is-ci`).
- No Husky, no lint-staged.
- No Nunjucks templates: the frontend keeps using `getDom()`.
- No DB migration or filename change: the SQLite file remains `chores.db` with the existing
  `completions` and `redemptions` schema.
- No CSS reorganisation: `MMM-Chores-Alt.css` stays at the repo root.
- No re-export of the compiled `MMM-Chores-Alt.js` from a `dist/` directory; MagicMirror loads
  it directly from the repo root.
- No coverage tooling. The reporter, `--coverage` flag, and any `coverage/` artefact are
  excluded. Tests aim for confidence in business logic and observable behaviour.
- No Prettier. Code style is enforced solely by ESLint.

---

## 3. Target file layout

```text
MMM-Chores-Alt/
├── MMM-Chores-Alt.js                 ← built artefact (committed)
├── MMM-Chores-Alt.js.map             ← source-map (committed)
├── MMM-Chores-Alt.css                ← unchanged, root-level
├── node_helper.js                    ← built artefact (committed)
├── node_helper.js.map                ← source-map (committed)
├── postinstall                       ← unchanged: runs @electron/rebuild
├── package.json
├── package-lock.json
├── .npmrc                            ← new: optional=true (cross-platform native deps)
├── tsconfig.json                     ← strict TS; compiler options for src/
├── tsconfig.test.json                ← extends tsconfig; includes __tests__
├── vite.config.frontend.ts           ← builds UMD frontend
├── vite.config.backend.ts            ← builds CJS backend
├── vitest.config.ts                  ← happy-dom env, src + __tests__
├── eslint.config.mjs                 ← extended with @typescript-eslint plugin
├── src/
│   ├── frontend/
│   │   ├── Frontend.ts               ← Module.register call site (entry)
│   │   ├── render.ts                 ← DOM builders (getDom helpers)
│   │   ├── stateDiff.ts              ← isStructurallySame + applyStateDiff (DOM patcher)
│   │   ├── pin.ts                    ← PIN keypad reducer
│   │   ├── delight.ts                ← confetti/sound/tally-bump dispatch
│   │   ├── stateReactor.ts           ← pure (prev, next) → Effect[]
│   │   └── icon.ts                   ← icon-type detection
│   ├── backend/
│   │   ├── index.ts                  ← Vite build entry: NodeHelper.create(createBackendSpec(...))
│   │   ├── Backend.ts                ← createBackendSpec(deps) factory (DI seam)
│   │   ├── repository.ts             ← IChoresRepository interface + ChoresRepository class
│   │   ├── tally.ts                  ← computeTally pure function
│   │   ├── stateBuilder.ts           ← buildStatePayload pure function
│   │   └── dateUtils.ts              ← todayStr pure function
│   ├── constants/
│   │   └── SocketNotifications.ts    ← string-enum of all socket notifications
│   └── types/
│       ├── Config.ts                 ← user-facing config types
│       ├── State.ts                  ← STATE payload types
│       ├── Domain.ts                 ← Child, Chore, Completion, Redemption
│       └── Effects.ts                ← reactor Effect discriminated union
├── __tests__/
│   ├── unit/
│   │   ├── backend/
│   │   │   ├── tally.test.ts
│   │   │   ├── stateBuilder.test.ts
│   │   │   ├── dateUtils.test.ts
│   │   │   ├── repository.test.ts          ← uses :memory: better-sqlite3
│   │   │   └── Backend.test.ts             ← thin wrapper + real :memory: repo
│   │   └── frontend/
│   │       ├── stateReactor.test.ts
│   │       ├── stateDiff.test.ts           ← happy-dom: structural compare + DOM patch
│   │       ├── pin.test.ts
│   │       ├── icon.test.ts
│   │       ├── render.test.ts              ← happy-dom DOM builders
│   │       ├── delight.test.ts             ← happy-dom: gating, class toggles, DOM cleanup
│   │       └── Frontend.test.ts            ← Module.register registration
│   └── setup.ts                            ← vitest setup (mocks Log, AudioContext stubs)
├── __mocks__/
│   ├── logger.ts                            ← Log mock (vi.fn() everywhere)
│   ├── node_helper.ts                       ← NodeHelper.create mock
│   └── Module.ts                            ← MM2ModuleHelper interface
└── docs/
    ├── magicmirror-sdk.md                   ← unchanged
    └── features/
        └── typescript-conversion.spec.md    ← this file
```

Files removed from the repo root after the conversion: the legacy `MMM-Chores-Alt.js` and
`node_helper.js` are replaced **in place** by their compiled equivalents. The build pipeline
overwrites the same paths.

---

## 4. Architecture refactor (backend)

### 4.1 Why refactor

The current `node_helper.js` is a single object literal that:
- holds DB handle, prepared statements, cron job, and config on `this`;
- mixes I/O (DB writes, socket sends) with business logic (`computeTally`, state assembly);
- is awkward to unit-test without mocking the entire `NodeHelper` runtime.

The refactor splits this into a **thin transport wrapper** (`Backend.ts`) and **pure or
narrowly-scoped service modules**.

### 4.2 Service modules

**`src/backend/repository.ts`** — interface `IChoresRepository` + class `ChoresRepository`.

```ts
export interface IChoresRepository {
  isOpen(): boolean
  close(): void
  insertCompletion(date: string, childId: string, choreId: string): boolean
  deleteCompletion(date: string, childId: string, choreId: string): void
  getCompletionsForDay(date: string, childId: string): string[]
  getAllCompletions(): { childId: string, choreId: string, count: number }[]
  insertRedemption(childId: string, amount: number, redeemedAt: string): void
  getRedeemedTotal(childId: string): number
}

export class ChoresRepository implements IChoresRepository {
  constructor(dbPath: string)               // opens DB, runs schema, prepares statements
  /* implements all IChoresRepository methods */
}
```

The interface exists so `Backend.ts` can be parameterised on a `repositoryFactory:
(path: string) => IChoresRepository` (see §4.3) without coupling the wrapper to the
concrete class. Tests pass `() => new ChoresRepository(':memory:')` for real in-memory
SQLite (no mocking).

`isOpen()` powers the re-INIT idempotence guard (see §5.4). It checks both that the
`Database` object exists *and* that the underlying handle has not been `close()`d
(`db.open === true` from better-sqlite3).

**`src/backend/tally.ts`** — pure function:

```ts
export function computeTally(
  childId: string,
  children: ChildConfig[],
  allCompletions: { childId: string, choreId: string, count: number }[],
  redeemedTotal: number
): number
```

No DB access; takes data and returns a number. Floors at 0 (preserves the existing
clamp-to-zero behaviour committed in `039e5dd`).

**`src/backend/stateBuilder.ts`** — pure function:

```ts
export function buildStatePayload(
  config: Config,
  today: string,
  todayCompletions: Map<string /*childId*/, Set<string /*choreId*/>>,
  allCompletions: { childId: string, choreId: string, count: number }[],
  redeemedByChild: Map<string, number>
): StatePayload
```

Produces the exact `STATE` payload shape that the current `sendState()` produces. No I/O.

**`src/backend/dateUtils.ts`** — pure `todayStr(date = new Date()): string` returning
`YYYY-MM-DD` in local time. Tests pass a fixed `Date` for determinism.

### 4.3 Thin wrapper (`src/backend/Backend.ts`)

The wrapper is exposed as a `createBackendSpec(deps)` factory that returns the
`NodeHelper.create` argument object. This is the **dependency-injection seam**: tests
call `createBackendSpec(...)` directly with an in-memory repository factory and skip
the `NodeHelper.create` indirection entirely. The module entry is a one-liner that
wires up production defaults.

```ts
export type BackendDeps = {
  repositoryFactory: (path: string) => IChoresRepository
  now?: () => Date                       // for deterministic date tests
}

export function createBackendSpec(deps: BackendDeps) {
  return {
    start() { /* nothing — wait for INIT */ },
    stop() { this.cronJob?.stop(); this.repository?.close(); },
    socketNotificationReceived(notif, payload) {
      switch (notif) {
        case SocketNotification.INIT:         return this.handleInit(payload)
        case SocketNotification.TOGGLE_CHORE: return this.handleToggle(payload)
        case SocketNotification.REDEEM:       return this.handleRedeem(payload)
      }
    },
    handleInit(config) { /* see §5.4 — uses deps.repositoryFactory(dbPath) */ },
    handleToggle({ childId, choreId }) { /* repo write + sendState */ },
    handleRedeem({ childId, pin }) { /* PIN check + repo write + sendState */ },
    sendState() { /* gather, call buildStatePayload, sendSocketNotification */ },
  }
}
```

Module entry (`src/backend/index.ts`, the actual Vite build entry):

```ts
import NodeHelper from 'node_helper'
import { ChoresRepository } from './repository'
import { createBackendSpec } from './Backend'

module.exports = NodeHelper.create(
  createBackendSpec({ repositoryFactory: (p) => new ChoresRepository(p) })
)
```

The wrapper holds `this.repository`, `this.config`, `this.cronJob` on the spec object
that `NodeHelper.create` consumes. Unit tests construct the spec via
`createBackendSpec({ repositoryFactory: () => new ChoresRepository(':memory:') })`,
attach a fake `sendSocketNotification` mock to the resulting object, then call
`handleInit/handleToggle/handleRedeem` directly — see §12.6.

---

## 5. Frontend refactor

### 5.1 `src/frontend/Frontend.ts`

The `Module.register("MMM-Chores-Alt", { ... })` call site, ported to TS using the
`@types/magicmirror-module` typings. It must remain the bundled entry-point. The module
object delegates rendering to helpers in `render.ts`, effects to `delight.ts`, state
diffing to `stateReactor.ts`, and PIN-keypad logic to `pin.ts`.

### 5.2 `src/frontend/stateReactor.ts` — pure-data effect emitter

```ts
export type Effect =
  | { kind: 'tally-bump',   childId: string, delta: number }
  | { kind: 'tally-dim',    childId: string }
  | { kind: 'all-done',     childId: string, color?: string }

export function reactToStateChange(
  prev: { tallies: Record<string, number>, allDone: Record<string, boolean> } | null,
  next: StatePayload
): { effects: Effect[], snapshot: { tallies: Record<string, number>, allDone: Record<string, boolean> } }
```

`Frontend.ts` keeps the snapshot in instance state; on each `STATE` payload it calls
`reactToStateChange`, dispatches the returned effects to DOM-side handlers in
`delight.ts` (which actually call `triggerConfetti`, `bumpTally`, `playSynthChime`), and
stores the new snapshot. Tests assert directly on the `Effect[]` output without touching
the DOM.

### 5.3 `src/frontend/pin.ts` — pure reducer

```ts
export type PinState = { input: string, error: string | null }
export type PinAction =
  | { type: 'digit', digit: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9' }
  | { type: 'back' }
  | { type: 'submit' }
  | { type: 'failed', reason: 'wrong_pin' | 'no_points' }
  | { type: 'reset' }

export function reducePin(state: PinState, action: PinAction): PinState
```

PIN length cap (8 digits) and 'wrong_pin' clearing the input both encoded in the reducer
and unit-tested. The PIN modal stays inside `getDom()` exactly as today; only the state
derivation moves out.

**Integration with `Frontend.ts`** — the existing `pinChildId` and `pinInput` fields are
unified into a single nullable state object:

```ts
// Frontend.ts instance state
this.pinModalState: { childId: string, input: string, error: string | null } | null

// open/close
openPinModal(childId)  → this.pinModalState = { childId, input: '', error: null }; this.updateDom()
closePinModal()        → this.pinModalState = null; this.updateDom()

// keypad handler
const reduced = reducePin(this.pinModalState, action)
this.pinModalState = { ...reduced, childId: this.pinModalState.childId }
this.updatePinDisplay(this.pinModalState)   // selective DOM mutation, no re-render
```

`childId` is carried alongside `PinState` rather than inside it: the reducer is pure
data on input/error, and `childId` is the modal's identity — separating the two keeps
the reducer focused and unit-testable in isolation.

### 5.5 `src/frontend/stateDiff.ts` — structural compare + DOM patcher

The current frontend uses two helpers (`isStructurallySame`, `applyStateDiff`) to patch
the DOM in place when the new `STATE` payload has the same shape as the previous one
- this preserves CSS animations on chore buttons across re-renders. Moving them out of
`Frontend.ts` makes them unit-testable in happy-dom.

```ts
export function isStructurallySame(prev: StatePayload | null, next: StatePayload): boolean
export function applyStateDiff(root: Element, next: StatePayload): boolean
```

`applyStateDiff` returns `false` if it cannot patch (e.g. a child section is missing
from the DOM) so the caller can fall back to a full `updateDom()`. Tests assert:

- `isStructurallySame` returns `false` on differing child counts, chore counts, child
  ids, or chore ids; returns `true` when shape matches even if `done` / `tally` differ.
- `applyStateDiff` toggles `.done` class, adds/removes the `.chore-done-badge`, and
  updates `.child-tally` text — without re-creating any element.
- `applyStateDiff` returns `false` when the expected `.child-section` is absent.

### 5.4 Re-INIT idempotence

Current code:
```js
if (notification === "INIT") {
  this.config = payload
  if (!this.db) { this.initDatabase() }   // ← duck-type guard
  this.scheduleMidnightReset()
  this.sendState()
}
```

New behaviour:
```ts
handleInit(config: Config) {
  this.config = config
  if (!this.repository || !this.repository.isOpen()) {
    this.repository = new ChoresRepository(path.join(this.path, 'chores.db'))
  }
  this.scheduleMidnightReset()   // .stop()s the previous schedule first
  this.sendState()
}
```

The decision to open a new DB is made via `repository.isOpen()`, which checks the
underlying `better-sqlite3` `Database#open` flag. This survives:
- a previous `repository.close()` call (e.g. from `stop()` followed by helper restart);
- a `repository` field that was assigned but had its handle externally closed.

Cron is unconditionally rescheduled (existing job is `.stop()`d first), matching today's
behaviour.

---

## 6. Build pipeline (Vite)

### 6.1 Why two configs

Vite's `build.lib` mode only supports a single entry per build. The project needs two
artefacts with different formats and externals (UMD/browser vs CJS/Node). Running `vite
build` twice with different config files is the cleanest expression. Both configs share
the same `tsconfig.json`.

### 6.2 `vite.config.frontend.ts`

```ts
import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    lib: { entry: 'src/frontend/Frontend.ts', formats: ['umd'], name: 'MMMChoresAlt',
           fileName: () => 'MMM-Chores-Alt.js' },
    outDir: '.',                   // root, NOT dist
    emptyOutDir: false,            // do NOT delete the css/postinstall etc.
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {               // pass-through; rollup options only where vite cannot
      external: ['logger'],
      output: { globals: { logger: 'Log' } },
    },
  },
})
```

### 6.3 `vite.config.backend.ts`

```ts
import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    lib: { entry: 'src/backend/index.ts', formats: ['cjs'],
           fileName: () => 'node_helper.js' /* entry: src/backend/index.ts */ },
    outDir: '.',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'terser',
    target: 'node20',
    rollupOptions: {
      external: ['node_helper', 'logger', 'better-sqlite3', 'node-cron',
                 'node:path', 'path', 'node:fs', 'fs'],
    },
  },
  ssr: { noExternal: [] },
})
```

### 6.4 npm scripts

```json
{
  "scripts": {
    "build:frontend": "vite build --config vite.config.frontend.ts",
    "build:backend":  "vite build --config vite.config.backend.ts",
    "build":          "npm run build:frontend && npm run build:backend",
    "dev":            "npm run build -- --watch",
    "lint":           "eslint .",
    "lint:fix":       "eslint . --fix",
    "test":           "vitest run",
    "test:watch":     "vitest",
    "postinstall":    "./postinstall"
  }
}
```

No `prepare`, no `lint-staged`, no `husky`, no `is-ci`, no `cypress`, no `prettier`,
no `@microsoft/eslint-formatter-sarif`, no coverage script.

---

## 7. Test stack (Vitest)

### 7.1 `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/unit/**/*.test.ts'],
    globals: false,                 // explicit imports of describe/it/expect
  },
  resolve: {
    alias: {
      logger: new URL('./__mocks__/logger.ts', import.meta.url).pathname,
      node_helper: new URL('./__mocks__/node_helper.ts', import.meta.url).pathname,
    },
  },
})
```

> **Note (happy-dom Web Audio):** happy-dom does not implement Web Audio. The tests
> stub `globalThis.AudioContext` to a no-op factory in `__tests__/setup.ts`; production
> playback paths are unit-tested at the *decision* level (does the code call
> `playSynthChime` for kind `complete`?) rather than the *acoustic* level. If audio
> playback ever needs richer simulation, switch the test environment to `jsdom` —
> jsdom also lacks Web Audio but interop with audio polyfills is more mature there.

### 7.2 Test scope

No coverage tooling, no thresholds. Aim for confident behavioural tests of:
- `repository.ts` (CRUD round-trips, idempotence, `isOpen()`)
- `tally.ts`, `stateBuilder.ts`, `dateUtils.ts` (pure-function tables)
- `stateReactor.ts` (effect emission)
- `stateDiff.ts` (structural compare + happy-dom DOM patcher)
- `pin.ts` (reducer table)
- `icon.ts` (image vs emoji classifier)
- `delight.ts` (gating + DOM-side outputs - see §7.4)
- `Backend.ts` (each socket-notification branch against a real `:memory:` repository)
- `Frontend.ts` (registration; `getStyles` returns the expected path; `getDom` smoke)

Confetti randomness (angle / colour / particle position) and acoustic audio output are
out of scope.

### 7.3 `__tests__/setup.ts`

```ts
import { vi, beforeAll, afterAll } from 'vitest'

vi.mock('logger')          // resolves via alias to __mocks__/logger.ts

beforeAll(() => {
  Object.defineProperty(globalThis, 'AudioContext', { value: vi.fn(), writable: true })
  Object.defineProperty(globalThis, 'webkitAudioContext', { value: vi.fn(), writable: true })
  globalThis.Log = { debug: vi.fn(), log: vi.fn(), info: vi.fn(),
                     warn: vi.fn(), error: vi.fn() } as any
  globalThis.Module = { register: vi.fn() } as any
})
```

### 7.4 Testing `delight.ts` (Q5 resolution)

`delight.ts` is the DOM-side dispatcher for visual / audible effects. Despite using
randomness and Web Audio, the unit-testable behaviours are well-defined. Refactor each
exported function to accept its dependencies as arguments (no module-level globals) so
tests can pass a fake `document`, fake `AudioContext`, and a deterministic RNG.

Recommended signatures:

```ts
type DelightDeps = {
  doc: Document
  now: () => number
  random: () => number       // fake to a counter for deterministic tests
  audio: AudioContext | null
  config: DelightConfig
  sounds: SoundsConfig
}

export function triggerConfetti(deps: DelightDeps, target: Element, opts?: ConfettiOpts): number
export function bumpTally(deps: DelightDeps, childId: string, delta: number): void
export function triggerAllDoneCelebration(deps: DelightDeps, child: ChildState): void
export function playChime(deps: DelightDeps, kind: 'complete'|'undo'|'fanfare'): 'file'|'synth'|'skip'
```

What `delight.test.ts` asserts (real values, observable in happy-dom):

| Behaviour | Assertion |
|---|---|
| `triggerConfetti` gating | `config.delight.confetti = false` → 0 elements appended; returns 0 |
| `triggerConfetti` particle count | default `count = 12` → `doc.body.querySelectorAll('.confetti-particle').length === 12` |
| Particle cleanup | dispatch `animationend` on a particle → particle removed from DOM |
| `bumpTally` positive delta | adds `bumping` class to `.child-tally` and creates `.tally-float` with text `+2` |
| `bumpTally` negative delta | adds `dimming` class; does NOT create a `.tally-float` |
| `bumpTally` zero delta | no-op (no class change, no float element) |
| `bumpTally` no matching section | no throw, no class change |
| `triggerAllDoneCelebration` gating | `config.delight.allDoneCelebration = false` → no class added, no confetti |
| `triggerAllDoneCelebration` cleanup | with `vi.useFakeTimers()`, advance 3 s → `.all-done` class is removed |
| `playChime` gating | `config.delight.sound = false` → returns `'skip'`; no audio creation |
| `playChime` file path | `config.sounds.complete = '/tmp/x.wav'` → returns `'file'`; an `Audio` object is constructed and `play()` called |
| `playChime` synth fallback | no file path → returns `'synth'`; `audio.createOscillator` + `audio.createGain` are invoked the expected number of times for the chime kind |

Pitfalls:

- `Audio` is a happy-dom global but does not actually decode media. Spy on its `play()`
  method and assert call count - do not assert on playback state.
- Inject `random()` so confetti angle / distance assertions are deterministic if needed.
- The shadow `setTimeout(..., 3000)` for `all-done` cleanup is the reason `vi.useFakeTimers`
  is mandatory for that test.

---

## 8. Cross-platform `package-lock.json`

### 8.1 Problem

`better-sqlite3` ships prebuilt native binaries via `prebuild-install`. On npm v9+, the
lockfile records the resolved tarball (which is platform-specific) under the `node_modules`
keys. Some optional dependencies of upstream packages are platform-gated (`os`/`cpu` fields).
A lockfile generated on macOS may refer to `darwin-arm64` binaries that do not exist on
the Raspberry Pi MagicMirror host.

### 8.2 Resolution

1. **`.npmrc` at repo root** with:
   ```ini
   optional=true
   ```
   Ensures `npm install` always considers all platform variants of optional dependencies,
   so the lockfile lists all OS/CPU permutations rather than just the developer's host.
2. **Keep the `postinstall` script** (`./postinstall`). It runs `@electron/rebuild` against
   the Electron version pinned in MagicMirror's `package.json`, recompiling
   `better-sqlite3` from source for the host. This is the authoritative cross-platform path.
3. **Document in README** that contributors must run `npm install` (which triggers the
   postinstall and lets npm resolve missing prebuilt binaries) rather than `npm ci --omit=optional`.
4. **Do not** add `os` or `cpu` fields to this project's own `package.json` — leave them
   absent so the package itself stays portable.

This avoids the practice (used by the reference repo) of adding `is-ci` as a runtime
dependency to short-circuit `prepare`. We have no `prepare` script and no Husky.

---

## 9. Type definitions

### 9.1 `src/types/Config.ts`

```ts
export type ChoreConfig = {
  id: string
  label?: string
  icon: string                  // emoji string OR path/URL (contains '/' or '.')
  points: number
}
export type ChildConfig = {
  id: string
  name: string
  color?: string                // hex
  chores: ChoreConfig[]
}
export type DelightConfig = {
  sound: boolean
  confetti: boolean
  tallyBump: boolean
  allDoneCelebration: boolean
}
export type SoundsConfig = {
  complete: string | null       // path or null → synth fallback
  undo:     string | null
}
export type Config = {
  children: ChildConfig[]
  parentPin: string
  delight: DelightConfig
  sounds: SoundsConfig
}
```

### 9.2 `src/types/State.ts`

```ts
export type ChoreState = {
  id: string
  label?: string
  icon: string
  points: number
  done: boolean
}
export type ChildState = {
  id: string
  name: string
  color?: string
  chores: ChoreState[]
  tally: number
}
export type StatePayload = { children: ChildState[] }
```

### 9.3 `src/constants/SocketNotifications.ts`

```ts
export enum SocketNotification {
  INIT          = 'INIT',
  TOGGLE_CHORE  = 'TOGGLE_CHORE',
  REDEEM        = 'REDEEM',
  STATE         = 'STATE',
  REDEEM_FAILED = 'REDEEM_FAILED',
}
export type RedeemFailedPayload = {
  childId: string
  reason: 'wrong_pin' | 'no_points'
}
```

### 9.4 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "ES2022"],
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "types": ["node", "magicmirror-module"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["__tests__/**/*", "node_modules", "dist"]
}
```

`tsconfig.test.json` extends this and re-includes `__tests__/**/*`.

---

## 10. Requirements

Each requirement is one behaviour, testable in isolation.

| # | Requirement |
|---|---|
| R1 | `npm run build` produces `MMM-Chores-Alt.js` and `node_helper.js` at the repo root, both with `.js.map` siblings. |
| R2 | The compiled `MMM-Chores-Alt.js` references `Log` as a global UMD external, not a bundled require. |
| R3 | The compiled `node_helper.js` does **not** bundle `better-sqlite3`, `node-cron`, `node_helper`, or `logger`. |
| R4 | `npm test` runs Vitest in `happy-dom` and exits 0 when all tests pass. |
| R5 | `npm install` succeeds on macOS arm64, macOS x64, and Linux arm64 (RPi MagicMirror host). |
| R6 | Sending `INIT` twice opens **one** SQLite handle. |
| R7 | Sending `INIT` after the helper's `stop()` opens a fresh SQLite handle. |
| R8 | `ChoresRepository#isOpen()` returns `true` after construction and `false` after `close()`. |
| R9 | `computeTally` returns 0 when total earned ≤ total redeemed (clamp). |
| R10 | `computeTally` ignores rows for `chore_id`s no longer in config. |
| R11 | `buildStatePayload` marks `chore.done = true` exactly when there is a row for `(today, childId, choreId)` in the completions table. |
| R12 | `TOGGLE_CHORE` toggles the same `(date, childId, choreId)` between absent and present. |
| R13 | `REDEEM` with the wrong PIN sends `REDEEM_FAILED { reason: 'wrong_pin' }` and writes nothing to `redemptions`. |
| R14 | `REDEEM` with correct PIN but `tally <= 0` sends `REDEEM_FAILED { reason: 'no_points' }` and writes nothing. |
| R15 | `REDEEM` with correct PIN and positive tally writes a row to `redemptions` with `amount = currentTally`, then broadcasts `STATE`. |
| R16 | `reactToStateChange` emits `tally-bump` when the next tally is greater than the previous. |
| R17 | `reactToStateChange` emits `tally-dim` when the next tally is less than the previous. |
| R18 | `reactToStateChange` emits `all-done` exactly on the transition from "not all done" to "all done" for a child with at least one chore. |
| R19 | `reactToStateChange` returns an empty effect list on the first state (no previous snapshot). |
| R20 | `reducePin('digit')` ignores keystrokes once the input has reached length 8. |
| R21 | `reducePin('failed', { reason: 'wrong_pin' })` clears the input and sets `error = 'Wrong PIN'`. |
| R22 | `icon.ts#isImageIcon` returns `true` for strings containing `/` or `.`, else `false`. |
| R23 | `Module.register('MMM-Chores-Alt', impl)` is called exactly once when `Frontend.ts` is imported. |
| R24 | The midnight cron handler calls `sendState()` and is `.stop()`d by `helper.stop()`. |
| R25 | `package.json` contains no dependency on `is-ci`, `husky`, `lint-staged`, `cypress`, `prettier`, `eslint-config-prettier`, or `@microsoft/eslint-formatter-sarif`. |
| R26 | The repository contains no `.github/workflows/`, no `.husky/`, no `lint-staged.config.*`, no `.prettierrc*`, no `.prettierignore`. |
| R27 | The compiled `MMM-Chores-Alt.js` is **not** re-exported from a `dist/` directory; it is the file MagicMirror loads. |
| R28 | `delight.triggerConfetti` returns `0` and appends no elements when `config.delight.confetti === false`. |
| R29 | `delight.bumpTally` adds the `bumping` CSS class and a `+N` `.tally-float` element on positive delta; adds `dimming` and no float on negative; is a no-op on zero. |
| R30 | `delight.triggerAllDoneCelebration` removes the `all-done` class 3 s after it is added (verified with fake timers). |
| R31 | `delight.playChime` returns `'skip'` when sound is disabled, `'file'` when a sound path is set, `'synth'` otherwise. |
| R32 | `stateDiff.isStructurallySame` returns `false` when child counts, chore counts, child ids, or chore ids differ; `true` when only `done` / `tally` differ. |
| R33 | `stateDiff.applyStateDiff` toggles the `done` class and `.chore-done-badge` and updates `.child-tally` text without re-creating elements. |
| R34 | `stateDiff.applyStateDiff` returns `false` when an expected `.child-section` is absent (so the caller can fall back to `updateDom()`). |
| R35 | The `postinstall` script exits 0 with a warning when invoked outside a MagicMirror parent (i.e. when `../../package.json` is absent), and continues to rebuild successfully when inside one. |

---

## 11. Acceptance criteria (Given–When–Then)

### AC1 — Build outputs (R1, R2, R3)

```text
Given a clean checkout with `npm install` complete
When  I run `npm run build`
Then  ./MMM-Chores-Alt.js exists, ./MMM-Chores-Alt.js.map exists,
      ./node_helper.js exists, ./node_helper.js.map exists
And   ./MMM-Chores-Alt.js does NOT contain a `require("logger")` call
And   ./node_helper.js does NOT contain `better-sqlite3` or `node-cron` source
And   ./node_helper.js DOES contain `require("better-sqlite3")` and
      `require("node-cron")` calls (externalised)
```

### AC2 — Re-INIT idempotence (R6, R7, R8)

```text
Given a fresh helper instance
When  I send INIT once
Then  helper.repository.isOpen() === true

Given a helper that has received INIT once
When  I send INIT again
Then  helper.repository is the same object as before (===)

Given a helper that has had stop() called
When  I send INIT
Then  helper.repository is a NEW instance whose isOpen() === true
```

### AC3 — TOGGLE_CHORE toggle (R12)

```text
Given an empty completions table and config with child 'alice', chore 'bed'
When  I send TOGGLE_CHORE { childId: 'alice', choreId: 'bed' } on date 2026-05-09
Then  the completions table contains one row (2026-05-09, 'alice', 'bed')
And   sendSocketNotification was called with STATE where children[0].chores[0].done === true

When  I send TOGGLE_CHORE { childId: 'alice', choreId: 'bed' } again on the same date
Then  the completions table contains zero rows
And   sendSocketNotification was called with STATE where children[0].chores[0].done === false
```

### AC4 — REDEEM with wrong PIN (R13)

```text
Given config.parentPin === '1234' and child 'alice' with tally 5
When  I send REDEEM { childId: 'alice', pin: '0000' }
Then  sendSocketNotification was called with
      ('REDEEM_FAILED', { childId: 'alice', reason: 'wrong_pin' })
And   the redemptions table is unchanged
```

### AC5 — REDEEM with no points (R14)

```text
Given config.parentPin === '1234' and child 'alice' with tally 0
When  I send REDEEM { childId: 'alice', pin: '1234' }
Then  sendSocketNotification was called with
      ('REDEEM_FAILED', { childId: 'alice', reason: 'no_points' })
And   the redemptions table is unchanged
```

### AC6 — REDEEM happy path (R15)

```text
Given config.parentPin === '1234' and child 'alice' with tally 7
When  I send REDEEM { childId: 'alice', pin: '1234' } at 2026-05-09T12:00:00.000Z
Then  the redemptions table contains a row
      (child_id='alice', amount=7, redeemed_at='2026-05-09T12:00:00.000Z')
And   the next STATE payload reports children.find(c=>c.id==='alice').tally === 0
```

### AC7 — State reactor effects (R16–R19)

```text
Given prev.tallies = { alice: 3 }
When  reactToStateChange(prev, next={ children: [{ id:'alice', tally:5, chores:[…2 done of 2] }]})
Then  effects contains { kind:'tally-bump', childId:'alice', delta:2 }
And   effects contains { kind:'all-done', childId:'alice' }
      (because alice transitioned from not-all-done to all-done)
```

### AC8 — PIN reducer (R20, R21)

```text
Given state = { input: '12345678', error: null }
When  reducePin(state, { type:'digit', digit:'9' })
Then  state.input === '12345678' (unchanged; cap reached)

Given state = { input: '0000', error: null }
When  reducePin(state, { type:'failed', reason:'wrong_pin' })
Then  state.input === '' AND state.error === 'Wrong PIN'
```

### AC9 — Icon classifier (R22)

```text
isImageIcon('🛏️')                                  → false
isImageIcon('🦷')                                   → false
isImageIcon('/modules/MMM-Chores-Alt/icons/x.png')  → true
isImageIcon('https://example.com/icons/room.png')   → true
isImageIcon('teeth.png')                            → true   (contains '.')
isImageIcon('')                                     → false
```

### AC10 — Frontend registration (R23)

```text
Given a fresh module under test (vi.resetModules)
When  I import 'src/frontend/Frontend'
Then  Module.register has been called exactly once
And   the first argument is 'MMM-Chores-Alt'
And   the second argument has typeof start === 'function'
And   defaults.parentPin === '0000'
```

### AC11 — No prohibited deps (R25, R26)

```text
Given the resulting package.json
When  I read its dependencies + devDependencies
Then  none of: is-ci, husky, lint-staged, cypress, prettier, eslint-config-prettier,
      @microsoft/eslint-formatter-sarif
And   ls .github/workflows  → does not exist
And   ls .husky             → does not exist
And   ls .prettierrc*       → does not exist
```

### AC12 — Delight gating + DOM behaviour (R28, R29, R30, R31)

```text
Given config.delight.confetti = false and a target <div> in the DOM
When  triggerConfetti(deps, target) is called
Then  it returns 0
And   document.body.querySelectorAll('.confetti-particle').length === 0

Given a section with .child-tally text "3pts" in the DOM
When  bumpTally(deps, 'alice', +2) is called
Then  the .child-tally element has class 'bumping'
And   document.body.querySelector('.tally-float').textContent === '+2'

Given vi.useFakeTimers() and a child section in the DOM
When  triggerAllDoneCelebration(deps, child) runs
And   vi.advanceTimersByTime(3000)
Then  the section no longer has class 'all-done'

Given config.delight.sound = true and config.sounds.complete = null
When  playChime(deps, 'complete') is called
Then  it returns 'synth'
And   deps.audio.createOscillator was called twice (C5 + E5)
```

### AC13 — stateDiff structural compare + DOM patch (R32, R33, R34)

```text
Given prev = { children: [{ id:'alice', chores:[{id:'bed'},{id:'teeth'}], tally:3 }] }
And   next = { children: [{ id:'alice', chores:[{id:'bed'},{id:'teeth'}], tally:5 }] }
When  isStructurallySame(prev, next)
Then  returns true                                       (only `tally` differs)

Given next = { children: [{ id:'alice', chores:[{id:'bed'}], tally:0 }] }
And   prev = { children: [{ id:'alice', chores:[{id:'bed'},{id:'teeth'}], tally:0 }] }
When  isStructurallySame(prev, next)
Then  returns false                                      (chore count differs)

Given a fully-rendered `.child-section[data-child-id='alice']` in the DOM
And   the `.chore-button[data-chore-id='bed']` has no `done` class
When  applyStateDiff(root, { children:[{ id:'alice', chores:[{id:'bed',done:true,...}],
        tally:1 }]})
Then  the bed button now has `done` class AND a `.chore-done-badge` child
And   `.child-tally` text is '1pts'
And   applyStateDiff returns true

Given the DOM is missing a child-section for 'alice'
When  applyStateDiff(root, payload) runs
Then  applyStateDiff returns false
```

---

## 12. Concrete test cases (real values)

### 12.1 `tally.test.ts`

```ts
const child: ChildConfig = { id:'alice', name:'Alice', chores:[
  { id:'bed', icon:'🛏️', points:1 },
  { id:'teeth', icon:'🦷', points:2 },
]}

// Case 1: 3 bed completions + 2 teeth completions, 0 redeemed
expect(computeTally('alice', [child],
  [{childId:'alice', choreId:'bed', count:3}, {childId:'alice', choreId:'teeth', count:2}],
  0)).toBe(7)                                             // 3*1 + 2*2

// Case 2: redeemed exceeds earned → clamped to 0
expect(computeTally('alice', [child],
  [{childId:'alice', choreId:'bed', count:1}], 99)).toBe(0)

// Case 3: stale chore_id no longer in config is ignored
expect(computeTally('alice', [child],
  [{childId:'alice', choreId:'window-washing-deprecated', count:5}], 0)).toBe(0)

// Case 4: rows for other children are ignored
expect(computeTally('alice', [child],
  [{childId:'bob', choreId:'bed', count:10}], 0)).toBe(0)

// Case 5: unknown child returns 0
expect(computeTally('charlie', [child], [], 0)).toBe(0)
```

### 12.2 `dateUtils.test.ts`

```ts
expect(todayStr(new Date(2026, 4, 9, 23, 59, 59))).toBe('2026-05-09')   // local
expect(todayStr(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')      // pad month
expect(todayStr(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
```

### 12.3 `repository.test.ts`

Open with `':memory:'` (better-sqlite3 supports this). Expected behaviours:

```ts
const repo = new ChoresRepository(':memory:')
expect(repo.isOpen()).toBe(true)

// insertCompletion is INSERT OR IGNORE → returns true on insert, false on duplicate
expect(repo.insertCompletion('2026-05-09', 'alice', 'bed')).toBe(true)
expect(repo.insertCompletion('2026-05-09', 'alice', 'bed')).toBe(false)

repo.deleteCompletion('2026-05-09', 'alice', 'bed')
expect(repo.getCompletionsForDay('2026-05-09', 'alice')).toEqual([])

repo.insertRedemption('alice', 5, '2026-05-09T12:00:00.000Z')
expect(repo.getRedeemedTotal('alice')).toBe(5)

repo.close()
expect(repo.isOpen()).toBe(false)
```

### 12.4 `pin.test.ts`

```ts
const empty = { input: '', error: null }

expect(reducePin(empty, { type: 'digit', digit: '5' }))
  .toEqual({ input: '5', error: null })

expect(reducePin({ input: '12', error: null }, { type: 'back' }))
  .toEqual({ input: '1', error: null })

expect(reducePin({ input: '12345678', error: null }, { type: 'digit', digit: '9' }))
  .toEqual({ input: '12345678', error: null })           // cap

expect(reducePin({ input: '0000', error: null }, { type: 'failed', reason: 'wrong_pin' }))
  .toEqual({ input: '', error: 'Wrong PIN' })

expect(reducePin({ input: '0000', error: 'Wrong PIN' }, { type: 'reset' }))
  .toEqual({ input: '', error: null })
```

### 12.5 `stateReactor.test.ts`

```ts
const prev = { tallies: { alice: 3, bob: 0 }, allDone: { alice: false, bob: true } }
const next: StatePayload = { children: [
  { id:'alice', name:'Alice', tally:5,
    chores:[{id:'a',icon:'🛏️',points:1,done:true},{id:'b',icon:'🦷',points:1,done:true}] },
  { id:'bob', name:'Bob', tally:0, chores:[] },
]}
const { effects } = reactToStateChange(prev, next)
expect(effects).toContainEqual({ kind:'tally-bump', childId:'alice', delta:2 })
expect(effects).toContainEqual({ kind:'all-done',  childId:'alice' })
expect(effects.find(e => e.childId === 'bob')).toBeUndefined()   // bob unchanged
```

First-state edge case:

```ts
const { effects, snapshot } = reactToStateChange(null, next)
expect(effects).toEqual([])
expect(snapshot.tallies).toEqual({ alice: 5, bob: 0 })
```

### 12.6 `Backend.test.ts`

Constructs the spec via `createBackendSpec({ repositoryFactory: () =>
new ChoresRepository(':memory:') })` (see §4.3), attaches a `vi.fn()` to
`spec.sendSocketNotification`, then calls `spec.handleInit/handleToggle/handleRedeem`
directly. The repository is **real** (in-memory SQLite) — no mocking of repository
methods. This means AC3-AC6 are testable end-to-end at the socket-payload level
without going through `NodeHelper.create`.

```ts
const config: Config = {
  parentPin: '1234',
  children: [{ id:'alice', name:'Alice', chores:[
    {id:'bed', icon:'🛏️', points:1}, {id:'teeth', icon:'🦷', points:2}
  ]}],
  delight: { sound:true, confetti:true, tallyBump:true, allDoneCelebration:true },
  sounds:  { complete:null, undo:null },
}

const spec = createBackendSpec({
  repositoryFactory: () => new ChoresRepository(':memory:'),
})
spec.path = '/tmp/test'                        // NodeHelper would normally set this
spec.sendSocketNotification = vi.fn()

spec.handleInit(config)
spec.handleToggle({ childId: 'alice', choreId: 'bed' })

const lastState = spec.sendSocketNotification.mock.calls.at(-1)![1] as StatePayload
expect(lastState.children[0].chores.find(c => c.id === 'bed')!.done).toBe(true)
expect(lastState.children[0].tally).toBe(1)
```

### 12.7 `Frontend.test.ts`

Patterned on the reference repo's `Frontend.test.ts` but using Vitest:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
const registerMock = vi.fn()
;(globalThis as any).Module = { register: registerMock }
await import('../../../src/frontend/Frontend')

it('registers MMM-Chores-Alt with expected defaults', () => {
  expect(registerMock).toHaveBeenCalledOnce()
  const [name, impl] = registerMock.mock.calls[0]
  expect(name).toBe('MMM-Chores-Alt')
  expect(impl.defaults.parentPin).toBe('0000')
  expect(impl.defaults.delight.sound).toBe(true)
})
```

---

## 13. Implementation pitfalls

1. **Vite `outDir: '.'` + `emptyOutDir: false`** — without `emptyOutDir: false`, Vite will
   refuse to delete files outside `dist/` (good) but it will warn. Set the flag explicitly
   and verify the css file, postinstall, and node_modules are untouched.
2. **UMD global name** — `name: 'MMMChoresAlt'` (or any valid JS identifier) is required
   for UMD. The actual MagicMirror runtime does not consume the global; it only requires
   that `Module.register` is invoked when the script runs. Test by loading the bundle in
   a clean Node REPL and confirming registration fires.
3. **`Module.register` import side-effect** — `Frontend.ts` registers at import time. In
   Vitest you must `vi.resetModules()` between tests or accept a single registration per
   file.
4. **better-sqlite3 in unit tests** — DO instantiate against `':memory:'`. DO NOT mock it.
   The reference repo's Backend test mocks `node_helper`; we follow that, but the
   `repository.test.ts` exercises real SQL.
5. **`@types/magicmirror-module`** — declares `Module.register` and `NodeHelper.create` as
   ambient namespaces. In Vitest with `globals: false`, the `Module` and `Log` globals
   must be installed in `__tests__/setup.ts` *before* any source import.
6. **Cron in tests** — `Backend.test.ts` should `vi.useFakeTimers()` and assert that the
   cron handler closure calls `sendState()`. Don't actually wait for midnight.
7. **`postinstall` invokes `@electron/rebuild`** — fails outside MagicMirror's parent
   directory. The script is patched in this phase to detect the absence of
   `../../package.json` and exit 0 with a warning (so a standalone clone for running
   tests works). Inside a MagicMirror tree, behaviour is unchanged. See R35 / Q17.
8. **Source-map stability** — Vite with `sourcemap: true` writes `.js.map` next to the
   bundle. Both must be `git add`ed. Avoid `sourcemap: 'inline'` (bloats committed file).
9. **No `dist/` re-export** — explicitly: there must be no `package.json#main` change and
   no `exports` field referencing `./dist/...`. `main` stays `MMM-Chores-Alt.js`.
10. **Delight randomness** — confetti uses `Math.random()`. Don't unit-test particle
    counts or angles. Test only that `triggerConfetti` is gated by
    `config.delight.confetti`.
11. **`AudioContext` in happy-dom** — undefined by default. Stub in `setup.ts` (see §7.3).
    If a test needs to assert a synth call, mock `playSynthChime` directly rather than
    introspecting Web Audio nodes.

---

## 14. Resolved decisions

| # | Decision |
|---|---|
| Q1 | **Two separate Vite configs** (one per artefact). Confirmed. |
| Q2 | `.npmrc` `optional=true` + existing `postinstall` running `@electron/rebuild`. Confirmed. |
| Q3 | **No coverage tooling** (no `coverage` script, no v8 reporter, no thresholds). Confirmed. |
| Q4 | `__mocks__` folder mirrors the reference repo, alias-resolved by Vitest. Confirmed. |
| Q5 | `delight.ts` is **unit-tested** (gating, class toggles, DOM cleanup, audio dispatch decision); see §7.4. Dependencies are passed in (no module-level globals) so happy-dom can drive them. Acoustic playback and confetti randomness are out of scope. Confirmed. |
| Q6 | Animations and PIN selective DOM mutation stay inside the registered module object. Confirmed. |
| Q7 | ESLint keeps the existing CSS plugin and adds `@typescript-eslint`. **No** `eslint-config-prettier`, **no** SARIF reporter. Confirmed. |
| Q8 | **No Prettier** in this project. ESLint is the sole style enforcer. Confirmed. |
| Q9 | Source-maps are committed; the legacy hand-written `MMM-Chores-Alt.js` is overwritten by the build. Confirmed. |
| Q10 | **Constructor (factory) injection** for the backend. `Backend.ts` exports `createBackendSpec({ repositoryFactory })` returning the `NodeHelper.create` spec; the production entry `src/backend/index.ts` wires the real `ChoresRepository` factory; tests pass `() => new ChoresRepository(':memory:')`. No module-level mutable binding, no `__setForTest__` hook. |
| Q11 | `Backend.test.ts` exercises a **real in-memory `ChoresRepository`** (not a mocked repository). Only `sendSocketNotification` is mocked. `repository.test.ts` covers the SQL surface in isolation. |
| Q12 | `isStructurallySame` and `applyStateDiff` move out of `Frontend.ts` into `src/frontend/stateDiff.ts` and gain their own happy-dom test file. Required because they hold the animation-preserving in-place patch behaviour. |
| Q13 | The `Frontend.ts` PIN modal state is unified into a single nullable `pinModalState: { childId, input, error } \| null`. `reducePin` operates on the `{ input, error }` slice; `childId` is carried alongside, not inside the reducer. |
| Q14 | `repository.ts` exports an `IChoresRepository` interface alongside the concrete class. The factory parameter and any non-`repository.test.ts` consumer types against the interface. |
| Q15 | MagicMirror types come from `@types/magicmirror-module` (verified available on npm, v2.16.6). No locally-shipped ambient declarations. If the upstream package drifts, switch to a pinned local `.d.ts` (fallback path only — not the default). |
| Q16 | The conversion lands in a **single atomic commit set on a feature branch**: scaffold `src/`, delete legacy hand-written `MMM-Chores-Alt.js` + `node_helper.js`, run the first `npm run build`, commit the new compiled artefacts at the same paths. No transitional `dist/` directory; no two-step swap. |
| Q17 | `postinstall` is patched to gracefully skip (`exit 0` with warning) when `../../package.json` is absent, so a standalone clone for running unit tests does not fail `npm install`. Inside a MagicMirror tree, `@electron/rebuild` runs as today. |

---

## 15. Deliverables

The implementation phase shall produce, in order of dependency:

1. `package.json` — new scripts, devDeps for TS / Vite / Vitest / happy-dom; keep the JS-stylistic ESLint ruleset and the CSS lint plugin (no Prettier to coexist with).
2. `.npmrc` (`optional=true`).
3. `tsconfig.json`, `tsconfig.test.json`.
4. `vite.config.frontend.ts`, `vite.config.backend.ts`.
5. `vitest.config.ts`, `__tests__/setup.ts`, `__mocks__/{logger,node_helper,Module}.ts`.
6. `src/types/{Config,State,Domain,Effects}.ts`, `src/constants/SocketNotifications.ts`.
7. `src/backend/{repository,tally,stateBuilder,dateUtils,Backend,index}.ts`.
8. `src/frontend/{icon,pin,stateReactor,stateDiff,delight,render,Frontend}.ts`.
9. `__tests__/unit/backend/*.test.ts` and `__tests__/unit/frontend/*.test.ts`.
10. Updated `eslint.config.mjs` (adds `@typescript-eslint` plugin + parser, keeps existing JS / CSS / Markdown blocks).
11. Updated `.gitignore` (add `*.tsbuildinfo`, `.vite/`).
12. Updated `README.md` with new build / test instructions and the cross-platform install note.
13. Updated `CLAUDE.md` reflecting the new TS architecture (see §16 below for required edits).
14. Patched `postinstall` (gracefully skips outside a MagicMirror tree — see Q17 / R35).
15. First successful `npm run build` checks in `MMM-Chores-Alt.js`, `MMM-Chores-Alt.js.map`, `node_helper.js`, `node_helper.js.map`, **and** deletes the previous hand-written `MMM-Chores-Alt.js` and `node_helper.js` in the same commit set (Q16).

The phase is complete when `npm install && npm run build && npm test && npm run lint`
all succeed on a fresh clone (macOS arm64) and the committed compiled artefacts are
byte-identical to the build outputs.

---

## 16. Documentation updates

The implementation phase MUST update the following two documents in the same commit set
that lands the conversion. Reviewers should use this section as a checklist.

### 16.1 `README.md`

Replace the "Installation" / "Development" sections with the new commands. At minimum:

- **Quick start** — `npm install` (postinstall rebuilds `better-sqlite3` for the host
  Electron). Add the cross-platform install note from §8: "use `npm install`, not
  `npm ci --omit=optional`, to allow native rebuild on the target platform".
- **Build** — `npm run build` produces both `MMM-Chores-Alt.js` and `node_helper.js` at
  the repo root (committed; MagicMirror loads them directly).
- **Develop** — `npm run dev` (Vite watch); `npm test` (Vitest); `npm run test:watch`;
  `npm run lint`; `npm run lint:fix`.
- **Project layout** — short summary of the `src/{frontend,backend,constants,types}`
  split and the `__tests__/unit/{frontend,backend}` mirror.
- **No CI / no Husky / no Prettier** — explicit one-liner so contributors don't expect them.
- **Configuration** — keep the existing children/chores config example. Update any code
  fences that referenced the old hand-written `MMM-Chores-Alt.js` to point at
  `src/frontend/Frontend.ts` for source-of-truth behaviour.

### 16.2 `CLAUDE.md`

Patch the project-instructions file so future agents pick up the new architecture
automatically. Required edits:

- **Tech Stack section** — replace "Vanilla JS / DOM rendering via getDom()" with
  "TypeScript compiled by Vite to UMD (frontend) and CJS (backend); strict types from
  `src/types/`; Vitest unit tests in `__tests__/unit/`". Keep the `getDom()` line — only
  the language / build pipeline changes.
- **Architecture diagram** — extend the directory tree to show `src/`, `__tests__/`,
  `__mocks__/`, and the two committed compiled artefacts at the root.
- **MagicMirror SDK Key Conventions section** — keep as is; the SDK contract is
  unchanged. Add one bullet: "Source code lives in `src/`; the committed
  `MMM-Chores-Alt.js` and `node_helper.js` are build artefacts — do not hand-edit them.
  Run `npm run build` after source changes."
- **New section "Testing"** — describe Vitest entry points, the happy-dom env, the
  in-memory SQLite pattern for `repository.test.ts`, and the policy that coverage
  thresholds are intentionally absent.
- **New section "Build & Install"** — record the cross-platform install note (§8) and
  the `postinstall → @electron/rebuild` flow.
- **Implementation Phase notes** — add a one-line mention that Phase 4 (TypeScript
  conversion) is complete, mirroring the existing Phase 1–3 status lines if they appear
  in `MEMORY.md`.

The CLAUDE.md edits should be terse and factual; do NOT duplicate the content of this
spec. The spec lives at `docs/features/typescript-conversion.spec.md` and is the
canonical reference — `CLAUDE.md` should link to it when it discusses the conversion.

