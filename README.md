# MMM-Chores-Alt

*MMM-Chores-Alt* is a module for [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)
that lets children track their daily chores on a touchscreen. Each child gets a panel
with large tap buttons (supporting emoji or images for pre-reading-age children), a live
point tally, and a parent-PIN-protected flow for redeeming points or adding bonuses.

## Screenshots

Chore buttons with live point tally per child:

![Chore buttons row showing Alice and Bob with chore icons and point tallies](docs/images/chores-row.png)

Parent-PIN redemption modal:

<img alt="Redemption modal with numeric keypad for entering parent PIN" src="https://github.com/MarnuLombard/MMM-Chores-Alt/blob/main/docs/images/redeem-modal.png" width="400px">

## Installation

### Install

```bash
cd ~/MagicMirror/modules
git clone [GitHub url] MMM-Chores-Alt
cd MMM-Chores-Alt
npm install
```

Storage uses Node's built-in `node:sqlite` module, so there is no native
module to compile and no `@electron/rebuild` step. The host running the
MagicMirror server (node_helper) must be **Node 24+**, where `node:sqlite`
is stable.

### Update

```bash
cd ~/MagicMirror/modules/MMM-Chores-Alt
git pull
npm install
```

## Configuration

Add the module to the `modules` array in `config/config.js`:

```js
{
  'module': "MMM-Chores-Alt",
  position: "fullscreen_below",
  config: {
    parentPin: "1234",
    displayFormat: { prefix: "", suffix: "pts" },
    children: [
      {
        id: "child1",
        name: "Alice",
        color: "#ff6b6b",
        chores: [
          { id: "make-bed",    label: "Make Bed",    icon: "🛏️", points: 1 },
          { id: "brush-teeth", label: "Brush Teeth", icon: "🦷", points: 1 },
          { id: "get-dressed", label: "Get Dressed", icon: "👕", points: 1 },
          { id: "tidy-room",   label: "Tidy Room",   icon: "🧹", points: 2 },
          { id: "homework",    label: "Homework",    icon: "📚", points: 3 },
        ]
      },
      {
        id: "child2",
        name: "Bob",
        color: "#4ecdc4",
        chores: [
          { id: "make-bed",    label: "Make Bed",    icon: "🛏️", points: 1 },
          // Local image path (relative to MagicMirror root)
          { id: "brush-teeth",  label: "Brush Teeth",  icon: "/modules/MMM-Chores-Alt/icons/teeth.png", points: 1 }, 
          // External/absolute URL
          { id: "tidy-room",    label: "Tidy Room",    icon: "https://example.com/icons/room.png",       points: 1 },
          { id: "tidy-room",   label: "Tidy Room",   icon: "🧹", points: 2 },
          { id: "homework",    label: "Homework",    icon: "📚", points: 3 },
        ]
      }
    ]
  }
}
```

## Configuration options

| Option          | Type   | Default                          | Description                                              |
|-----------------|--------|----------------------------------|----------------------------------------------------------|
| `children`      | Array  | `[]`                             | List of child objects (see schema below)                 |
| `parentPin`     | String | `"0000"`                         | PIN required to redeem or adjust a child's tally         |
| `displayFormat` | Object | `{ prefix: "", suffix: "pts" }`  | Wraps the rendered tally (see Display format below)      |
| `monetaryMode`  | Boolean| `false`                          | Adds a decimal key for fractional redeem/adjust amounts  |

### Display format

`displayFormat` controls how the running tally is rendered. It has two
fields:

| Field    | Type   | Description                                |
|----------|--------|--------------------------------------------|
| `prefix` | String | Text rendered before the number (e.g. `$`) |
| `suffix` | String | Text rendered after the number (e.g. `pts`)|

The number itself is auto-formatted: integer values render plain (`15`),
fractional values render with 2 decimal places (`1.50`). 2dp rounding also
suppresses floating-point artefacts like `0.1 + 0.2 = 0.30000000000000004`.

Default (points):

```js
displayFormat: { prefix: "", suffix: "pts" }
// renders "15pts"
```

Pocket-money mode (use fractional `points` per chore):

```js
displayFormat: { prefix: "$", suffix: "" },
children: [{
  id: "child1", name: "Alice",
  chores: [
    { id: "make-bed", label: "Make Bed", icon: "🛏️", points: 0.10 },
    { id: "homework", label: "Homework", icon: "📚", points: 0.50 },
  ],
}]
// renders "$1.50"
```

To let parents enter fractional amounts when redeeming or adjusting, also set
`monetaryMode: true` (see [Redeeming and adjusting tallies](#redeeming-and-adjusting-tallies)).

### Child object schema

| Field    | Type   | Required | Description           |
|----------|--------|----------|-----------------------|
| `id`     | String | Yes      | Unique identifier     |
| `name`   | String | Yes      | Display name          |
| `color`  | String | No       | Accent colour (hex)   |
| `chores` | Array  | Yes      | List of chore objects |

### Chore object schema

| Field    | Type   | Required | Description                                                                              |
|----------|--------|----------|------------------------------------------------------------------------------------------|
| `id`     | String | Yes      | Unique identifier within the child's list                                                |
| `icon`   | String | Yes      | Emoji string **or** image path/URL — paths containing `/` or `.` are rendered as `<img>` |
| `label`  | String | No       | Text shown below the icon (omit if icon is self-explanatory)                             |
| `points` | Number | Yes      | Points awarded on completion                                                             |

## Redeeming and adjusting tallies

Each child panel has two parent-PIN-protected buttons next to the tally:

- **Redeem** - spend points. Enter the PIN, then an amount up to the current
  tally (the field is pre-filled with the full tally). Partial redemptions are
  supported, so a child can cash out some points and keep the rest. The button
  is disabled when the tally is zero.
- **`+` (adjust)** - add a bonus (allowance, gifts, one-off rewards). Enter the
  PIN, then the amount to add. Adjustments raise the tally and, like earned
  points, are preserved across the midnight reset.

Both actions use the same two-phase modal: PIN entry first, then amount entry.
The PIN is re-checked on the server for every redeem or adjust - entering it
once does not grant a lasting session.

### Monetary mode

The amount keypad is integer-only by default. Set `monetaryMode: true` to add a
decimal (`.`) key so parents can enter fractional amounts such as `1.50`. Pair it
with a money-style `displayFormat` and fractional chore `points`:

```js
config: {
  parentPin: "1234",
  monetaryMode: true,
  displayFormat: { prefix: "$", suffix: "" },
  // ...children with fractional `points`
}
```

## Development

Source lives in `src/` (TypeScript, strict). Build artefacts (`MMM-Chores-Alt.js`,
`node_helper.js`, and their `.js.map` siblings) are committed at the repo root so
MagicMirror loads them directly - do not hand-edit them.

- `npm install` - install dependencies (triggers `@electron/rebuild`)
- `npm run build` - build both frontend (UMD) and backend (CJS) artefacts
- `npm run dev` - watch-mode build
- `npm test` - run Vitest unit tests
- `npm run test:watch` - watch-mode tests
- `npm run lint` / `npm run lint:fix` - ESLint

No CI workflows, no Husky, no Prettier - ESLint is the sole style enforcer.

### Project layout

```text
src/
  frontend/    Frontend.ts (entry), render, stateDiff, stateReactor,
               pin, delight, icon
  backend/     index.ts (entry), Backend, repository, tally, stateBuilder,
               dateUtils
  constants/   SocketNotifications
  types/       Config, State, Domain, Effects
__tests__/unit/{frontend,backend}/   Vitest unit tests (happy-dom env)
```

See [`docs/features/typescript-conversion.spec.md`](docs/features/typescript-conversion.spec.md)
for the full conversion spec.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE.md) file for details.

## Changelog

All notable changes to this project will be documented in the [CHANGELOG.md](CHANGELOG.md) file.
