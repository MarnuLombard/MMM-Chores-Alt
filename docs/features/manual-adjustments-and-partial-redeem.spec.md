# Manual Adjustments and Partial Redemption

Two coupled additions to the chore tally flow, both gated by the existing parent PIN.

1. **Manual adjustment ("+") button** - per-child button that lets a parent add an arbitrary amount to a child's tally (bonuses, allowance, gifts).
2. **Partial redemption** - "Redeem" no longer empties the tally; the parent enters an amount up to the current tally.

Both features share the same two-phase modal: PIN entry first, then amount entry.

## Approach

Test-driven. For each unit (amount reducer, monetary-mode helper, backend handlers, render output), write failing tests first, then the smallest implementation that makes them pass, then refactor. Backend tests use the in-memory `ChoresRepository(':memory:')` per the existing pattern in `__tests__/unit/backend/Backend.test.ts`. Commit at green points.

## Storage model

Reuse the existing `redemptions` table with a **signed amount** convention.

```text
redemptions.amount > 0  -> redemption (lowers tally)   [existing]
redemptions.amount < 0  -> adjustment (raises tally)   [new]
```

`computeTally` already uses `earned - SUM(redemptions.amount)`, so the math is unchanged. The column name `redeemed_at` becomes a slight semantic stretch (it now also covers adjustment timestamps); accepted to avoid a migration. Document the convention in `repository.ts`.

No new tables. No schema migration. Existing rows untouched.

## Config additions

`src/types/Config.ts`:

```ts
type Config = {
  // ...existing fields
  monetaryMode?: boolean   // default false
}
```

When `monetaryMode` is true, the amount-entry keypad shows a `.` key and tally formatting permits decimals. When false, amount entry is integer-only. Default in `Frontend.ts` `defaults` block is `false`.

This replaces the prior idea of inferring monetary mode from `displayFormat.prefix` or fractional chore points. Explicit config is simpler and matches user-stated preference.

## SocketNotification additions

| Notification | Direction | Payload | Notes |
|---|---|---|---|
| `VERIFY_PIN` | FE -> BE | `{ childId, pin, intent: "redeem" \| "adjust" }` | Phase-1 PIN check |
| `PIN_VERIFIED` | BE -> FE | `{ childId, intent, tally }` | Tally included so amount view shows current value |
| `ADJUST` | FE -> BE | `{ childId, pin, amount }` | `amount > 0` required |
| `REDEEM` (modified) | FE -> BE | `{ childId, pin, amount }` | `amount > 0 && amount <= tally` required |
| `REDEEM_FAILED` (extended) | BE -> FE | `{ childId, reason: "wrong_pin" \| "no_points" \| "insufficient" }` | Reused for `REDEEM` and `ADJUST` failures (`ADJUST` can only fail with `wrong_pin`) |

Backend re-verifies the PIN on `REDEEM` / `ADJUST`; a prior `VERIFY_PIN` does not grant a session. No server-side session state.

## Frontend UX

### Per-child row layout

Current row: `name  chores...  tally  [Redeem]`

New row: `name  chores...  tally  [+]  [Redeem]`

The `+` button sits immediately to the left of `Redeem`, with the same touch-target size. Label is the literal `+` glyph. Uses the child's accent color (same treatment as the existing redeem button styling). Both buttons are disabled-styled when `state == null`. `Redeem` is additionally disabled when `tally <= 0`. `+` is always enabled when state is loaded.

### Modal phases (single `pin-modal` element, two views)

**Phase 1 - PIN entry** (existing visuals):
- Title for adjust intent: `Add bonus for {name}`.
- Title for redeem intent: `Redeem {name}'s points` (existing).
- Confirm sends `VERIFY_PIN` with the intent.
- On `REDEEM_FAILED reason=wrong_pin` -> show "Wrong PIN" error, clear input (existing pin reducer behaviour).
- On `PIN_VERIFIED` -> transition modal to Phase 2; keep the PIN string in `pinModalState` for the second round-trip.

**Phase 2 - Amount entry**:
- Title carries over from Phase 1.
- Large amount display formatted via `formatTally` (uses `displayFormat`).
- Current tally shown below as `Available: {formatted tally}` (redeem only).
- Numeric keypad: `1-9, ., 0, ⌫` plus `Cancel` and `✓`.
- `.` key is only rendered when `config.monetaryMode === true`.
- Redeem mode pre-fills the amount with the full tally.
- Adjust mode starts empty (display shows `0` or formatted-zero).
- `✓` sends `REDEEM` or `ADJUST` with `{ childId, pin, amount }`.
- On `REDEEM_FAILED reason=insufficient` -> show "Not enough points" error, do not close modal, leave amount editable.
- On successful state refresh -> close modal.
- On successful adjust commit -> fire the existing confetti effect over the child's row (`triggerConfetti` against the child's section element) before the modal closes.

### `pinModalState` extension

```ts
type PinModalState = {
  childId: string
  intent: "redeem" | "adjust"
  phase: "pin" | "amount"
  pinInput: string
  pinError: string | null
  amountInput: string
  amountError: string | null
  verifiedPin: string | null   // set when phase transitions; sent with REDEEM/ADJUST
}
```

`updatePinModal` becomes phase-aware - directly mutates `.pin-display`, `.pin-error`, `.amount-display`, `.amount-error`. Keep the direct-DOM pattern; do not re-render on every keypress.

After a successful `ADJUST` or `REDEEM`, the modal closes and `pinModalState` is cleared. If the parent then taps `Redeem` or `+` again, they re-enter PIN from scratch (no implicit re-authorisation).

### Amount reducer (new `src/frontend/amount.ts`)

```ts
type AmountState = { input: string, error: string | null }
type AmountAction =
  | { type: "digit", digit: "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9" }
  | { type: "dot" }
  | { type: "back" }
  | { type: "set", value: string }
  | { type: "failed", reason: "insufficient" }
  | { type: "reset" }

const MAX_WHOLE_DIGITS = 8
const MAX_DECIMALS = 2
```

Rules:
- Reject second `.` (no-op).
- Cap fractional part at 2 decimal places.
- Cap whole part at 8 digits.
- `back` removes one trailing character.
- `set` is used to pre-fill with the current tally on Phase 2 entry for redeem mode; value is formatted as a plain numeric string (e.g. `"1.50"`, `"15"`).
- `parseAmount(state.input): number` -> `0` for empty or `"."`; otherwise `Math.round(Number(state.input) * 100) / 100`.

`isMonetaryMode(config): boolean` reads `config.monetaryMode === true`. No inference from format/chore points.

`pin.ts` is unchanged.

## Backend changes

### `Backend.ts` new/changed handlers

```ts
type VerifyPinPayload = { childId: string, pin: string, intent: "redeem" | "adjust" }
type RedeemPayload    = { childId: string, pin: string, amount: number }   // amount is new
type AdjustPayload    = { childId: string, pin: string, amount: number }

handleVerifyPin(payload):
  if pin !== config.parentPin -> REDEEM_FAILED { childId, reason: "wrong_pin" }
  else -> PIN_VERIFIED { childId, intent, tally: computeTally(...) }

handleAdjust(payload):
  if pin !== config.parentPin -> REDEEM_FAILED wrong_pin
  if !(amount > 0) -> ignore (defensive; FE should prevent)
  amount = round2(amount)
  repository.insertRedemption(childId, -amount, now().toISOString())
  sendState()

handleRedeem(payload):    // signature changed
  if pin !== config.parentPin -> REDEEM_FAILED wrong_pin
  tally = computeTally(...)
  if tally <= 0 -> REDEEM_FAILED no_points
  amount = round2(payload.amount)
  if !(amount > 0) -> REDEEM_FAILED no_points
  if amount > tally -> REDEEM_FAILED insufficient
  repository.insertRedemption(childId, +amount, now().toISOString())
  sendState()
```

`round2(x) = Math.round(x * 100) / 100`.

### `repository.ts`

No API surface change. Add a comment above `insertRedemption` documenting the signed convention.

## Requirements

### R1 - Manual adjustment
- R1.1 A `+` button is rendered in every child section, immediately to the left of `Redeem`.
- R1.2 Tapping `+` opens the PIN modal with `intent="adjust"`. Title: `Add bonus for {name}`.
- R1.3 With correct PIN, the modal transitions to amount-entry; the amount field starts empty.
- R1.4 Confirming with `amount > 0` inserts a row into `redemptions` with `amount = -inputAmount` and closes the modal.
- R1.5 Adjustments correctly increase the child's computed tally on the next `STATE` payload.
- R1.6 On successful adjust commit, confetti fires over the child's section (using existing `triggerConfetti`).
- R1.7 Wrong PIN shows "Wrong PIN" and keeps the modal open in Phase 1.
- R1.8 Cancel at any point closes the modal without mutation.
- R1.9 After a successful adjust, the modal is closed; tapping `Redeem` next requires fresh PIN entry.

### R2 - Partial redemption
- R2.1 Tapping `Redeem` opens the PIN modal with `intent="redeem"`.
- R2.2 The Redeem button is disabled when the child's tally is `<= 0`.
- R2.3 After successful PIN entry, the amount-entry view pre-fills with the **full current tally** formatted via `formatTally`.
- R2.4 Confirming with `0 < amount <= tally` inserts a positive redemption and closes the modal.
- R2.5 Confirming with `amount > tally` shows "Not enough points" and keeps the modal in Phase 2.
- R2.6 Confirming with `amount === tally` matches today's full-redeem behaviour (tally goes to 0).
- R2.7 Wrong PIN shows "Wrong PIN" and keeps the modal in Phase 1.

### R3 - Amount entry
- R3.1 When `config.monetaryMode === false` (or absent), the `.` key is not rendered.
- R3.2 When `config.monetaryMode === true`, the `.` key is rendered.
- R3.3 Pressing `.` when input already contains `.` is a no-op.
- R3.4 Input is capped at 8 whole-number digits and 2 decimal places.
- R3.5 `⌫` removes one trailing character; pressing it on empty input is a no-op.
- R3.6 Confirming with empty input (or parsed amount `<= 0`) does not send a socket notification.

### R4 - PIN handling
- R4.1 Backend re-validates the PIN on every `REDEEM` and `ADJUST`; `PIN_VERIFIED` does not grant a session.
- R4.2 The frontend stores the verified PIN only in transient `pinModalState`; cleared when the modal closes.
- R4.3 PIN comparison remains plain-text against `config.parentPin`.

### R5 - State and rendering
- R5.1 After any successful `ADJUST` or `REDEEM`, the next `STATE` payload reflects the new tally and the modal closes.
- R5.2 No audit history is shown in the UI; the row only ever shows the current tally.
- R5.3 `isStructurallySame` must continue to return true across adjust/redeem so the diff-based update path keeps working through tally-only changes.

## Acceptance criteria

```gherkin
Scenario: Parent adds bonus points
  Given child "Alice" has tally 15pts and parent PIN is "1234"
  When parent taps "+" on Alice's row
   And enters PIN "1234"
   And enters amount "5" and confirms
  Then a row exists in redemptions with (child_id="alice", amount=-5)
   And the next STATE payload shows Alice's tally as 20pts
   And confetti is triggered over Alice's section
   And the modal is closed

Scenario: Parent does a partial redemption in monetary mode
  Given child "Bob" has tally 1.50, displayFormat={prefix:"$", suffix:""}, monetaryMode=true
  When parent taps "Redeem" on Bob's row
   And enters PIN "1234"
   And the amount field is pre-filled with "1.50"
   And parent backspaces twice and types "0" "0" giving "1.00"
   And confirms
  Then a row exists in redemptions with (child_id="bob", amount=1.00)
   And the next STATE payload shows Bob's tally as $0.50

Scenario: Redemption rejected when amount exceeds tally
  Given child "Cara" has tally 8pts
  When parent enters PIN "1234" then amount "9" and confirms Redeem
  Then backend responds REDEEM_FAILED { reason: "insufficient" }
   And the modal stays in Phase 2 showing "Not enough points"
   And no redemption row is inserted

Scenario: Wrong PIN never reveals amount view
  Given child "Dani" has tally 10pts
  When parent enters PIN "9999" and confirms (for either + or Redeem)
  Then backend responds REDEEM_FAILED { reason: "wrong_pin" }
   And the modal stays in Phase 1 with input cleared and "Wrong PIN" shown
   And no PIN_VERIFIED message is sent

Scenario: Redeem button disabled at zero tally
  Given child "Eli" has tally 0pts
  Then the Redeem button on Eli's row has the disabled style
   And tapping it produces no socket notification
   And the + button on Eli's row remains enabled

Scenario: Decimal key absent in non-monetary mode
  Given config.monetaryMode is false
  When the amount-entry view renders
  Then the keypad contains keys 0-9 and ⌫ only; there is no "." key

Scenario: Adjust then redeem requires fresh PIN
  Given parent has just successfully adjusted +5 for Alice and the modal closed
  When parent taps "Redeem" on Alice's row
  Then the PIN modal opens in Phase 1 with empty input
   And no socket notification is sent until PIN is entered and confirmed

Scenario: Adjustment survives a daily reset
  Given child "Finn" has earned 5pts today and parent adjusted +3
  When midnight cron fires and sends fresh STATE
  Then today's completions are reset to empty
   And Finn's tally remains 8pts
```

## Test cases (concrete values)

### Backend (`__tests__/unit/backend/Backend.test.ts`)

```ts
// adjust raises tally
adjust("alice", pin="1234", amount=5)
  -> repository.getRedeemedTotal("alice") returns -5
  -> next STATE.children["alice"].tally === existing + 5

// partial redeem
seed: alice earned 20 by completions; no prior redemptions
redeem("alice", pin="1234", amount=7)
  -> repository row: amount = 7
  -> STATE.alice.tally === 13

// partial redeem in monetary mode
seed: bob has tally 1.50 (from 0.10 x 15 completions), monetaryMode=true
redeem("bob", pin="1234", amount=1.00)
  -> repository row: amount = 1.0
  -> STATE.bob.tally === 0.50

// insufficient
seed: alice tally = 5
redeem("alice", pin="1234", amount=10)
  -> sendSocketNotification called with REDEEM_FAILED reason="insufficient"
  -> no row inserted

// wrong pin on adjust
adjust("alice", pin="0000", amount=5)
  -> REDEEM_FAILED reason="wrong_pin"
  -> no row inserted

// verify pin success
verifyPin("alice", pin="1234", intent="redeem")
  -> PIN_VERIFIED { childId:"alice", intent:"redeem", tally:5 }

// round to 2dp
adjust("alice", pin="1234", amount=0.1 + 0.2)
  -> repository row: amount = -0.30

// adjust does not affect today's completions
adjust("alice", pin="1234", amount=5)
  -> repository.getCompletionsForDay(today, "alice") returns same set as before
```

### Frontend amount reducer (`__tests__/unit/frontend/amount.test.ts`)

```ts
reduce({input:"", error:null}, {type:"digit", digit:"1"})            -> {input:"1", error:null}
reduce({input:"1", error:null}, {type:"digit", digit:"2"})           -> {input:"12", error:null}
reduce({input:"12", error:null}, {type:"dot"})                        -> {input:"12.", error:null}
reduce({input:"12.", error:null}, {type:"dot"})                       -> {input:"12.", error:null}    // second dot ignored
reduce({input:"12.3", error:null}, {type:"digit", digit:"4"})         -> {input:"12.34", error:null}
reduce({input:"12.34", error:null}, {type:"digit", digit:"5"})        -> {input:"12.34", error:null}  // 2dp cap
reduce({input:"12345678", error:null}, {type:"digit", digit:"9"})     -> {input:"12345678", error:null} // 8 whole-digit cap
reduce({input:"12", error:null}, {type:"back"})                       -> {input:"1", error:null}
reduce({input:"", error:null}, {type:"back"})                         -> {input:"", error:null}
reduce({input:"5", error:null}, {type:"set", value:"15.00"})          -> {input:"15.00", error:null}
reduce({input:"5", error:null}, {type:"failed", reason:"insufficient"}) -> {input:"5", error:"Not enough points"}

parseAmount({input:""})    -> 0
parseAmount({input:"."})   -> 0
parseAmount({input:"1.50"})-> 1.5
parseAmount({input:"0.1"}) -> 0.1
```

### Monetary-mode helper

```ts
isMonetaryMode({ monetaryMode: true,  /* ...rest */ }) -> true
isMonetaryMode({ monetaryMode: false, /* ...rest */ }) -> false
isMonetaryMode({ /* monetaryMode omitted */ })          -> false
```

### Frontend render (`__tests__/unit/frontend/render.test.ts`)

```ts
// + button rendered next to Redeem
const el = renderChildSection(child, format, onChore, onRedeem, onAdjust)
const adjust = el.querySelector(".adjust-button")
const redeem = el.querySelector(".redeem-button")
expect(adjust).not.toBeNull()
expect(redeem).not.toBeNull()
expect(adjust!.compareDocumentPosition(redeem!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

// + label is "+"
expect(adjust!.textContent).toBe("+")

// Redeem disabled at zero tally; + still enabled
const zero = { ...child, tally: 0 }
const el2 = renderChildSection(zero, ...)
expect(el2.querySelector(".redeem-button")!.hasAttribute("disabled")).toBe(true)
expect(el2.querySelector(".adjust-button")!.hasAttribute("disabled")).toBe(false)

// Amount keypad omits decimal in non-monetary mode
const modal = renderPinModal(name, "", { intent:"redeem", phase:"amount", monetary:false }, ...)
expect(modal.querySelector(".pin-key-dot")).toBeNull()

// Amount keypad shows decimal in monetary mode
const modal2 = renderPinModal(name, "", { intent:"redeem", phase:"amount", monetary:true }, ...)
expect(modal2.querySelector(".pin-key-dot")).not.toBeNull()
```

## Implementation notes

### TDD order

Work outside-in, one slice at a time:

1. **Config type and default**: add `monetaryMode?: boolean` to `Config`; add `monetaryMode: false` to `defaults` in `Frontend.ts`. No test - type-only.
2. **`amount.ts` reducer + `parseAmount` + `isMonetaryMode`**: write `amount.test.ts` covering every case above, then implement until green.
3. **SocketNotifications**: extend enum and `RedeemFailedPayload`. No standalone test; covered transitively by Backend tests.
4. **Backend `handleVerifyPin`, `handleAdjust`, updated `handleRedeem`**: red tests in `Backend.test.ts` first (all cases above), then implement. Each handler is one commit cycle.
5. **Render: `+` button, disabled Redeem, amount phase**: write `render.test.ts` cases, then implement.
6. **`Frontend.ts` phase state machine**: add modal-state shape and transition wiring. Drive via integration-style assertions where possible, or hand-verify in the running module after lower layers are green.
7. **CSS**: add `.adjust-button`, `.amount-display`, `.amount-error`, `.pin-key-dot`, and `[disabled]` styling for `.redeem-button`.
8. **Build artefacts**: `npm run build` produces fresh `MMM-Chores-Alt.js` and `node_helper.js`; commit those.

### Where to extend

| Concern | File |
|---|---|
| `monetaryMode` config field | `src/types/Config.ts` |
| Amount reducer, parseAmount, isMonetaryMode | `src/frontend/amount.ts` (new) |
| Render `+`, disabled `Redeem`, amount-phase keypad | `src/frontend/render.ts` |
| Modal phase state machine | `src/frontend/Frontend.ts` |
| `VERIFY_PIN`, `PIN_VERIFIED`, `ADJUST`; `REDEEM_FAILED.reason` union | `src/constants/SocketNotifications.ts` |
| `handleVerifyPin`, `handleAdjust`, updated `handleRedeem` | `src/backend/Backend.ts` |
| Signed-amount convention comment | `src/backend/repository.ts` |
| Styles | `MMM-Chores-Alt.css` |
| `defaults` includes `monetaryMode: false` | `src/frontend/Frontend.ts` |

### Pitfalls

- **Floating point**: always pass amounts through `round2` on the backend before insert; `parseAmount` rounds on the frontend. Tests must cover `0.1 + 0.2`.
- **Modal re-renders**: keep direct DOM manipulation for phase transitions and key feedback. A full `updateDom()` would lose in-progress input.
- **STATE during modal**: if `STATE` lands while the modal is open (midnight cron, another tab), do not close the modal. Preserve the existing `inPinModal` guard logic in the new phase-aware modal.
- **PIN re-verification**: do not skip the PIN check on `REDEEM`/`ADJUST` even after `PIN_VERIFIED`. No sessions.
- **Confetti hook for adjust**: the existing `triggerConfetti` takes an element. The natural anchor is the child's `.child-section` (not a chore button, which is the existing call site). Pass that element from `Frontend.ts` when the adjust commit succeeds.
- **`isStructurallySame`**: tally-only deltas must remain a non-structural diff so the modal survives the STATE refresh that follows commits.

### Out of scope

- No audit/history UI.
- No max-amount cap.
- No negative adjustments / penalties (parents can't dock points in this version).
- No keyboard input (touchscreen-only).
- No "stay open" multi-action modal session.

## Deliverables

| Path | Status | Purpose |
|---|---|---|
| `src/types/Config.ts` | modified | Add `monetaryMode?: boolean` |
| `src/frontend/amount.ts` | new | Amount reducer + `parseAmount` + `isMonetaryMode` |
| `src/frontend/render.ts` | modified | `+` button, disabled Redeem, amount-phase keypad |
| `src/frontend/Frontend.ts` | modified | Modal phase state machine; `monetaryMode: false` default; adjust-success confetti hook |
| `src/frontend/pin.ts` | unchanged | (kept as-is) |
| `src/backend/Backend.ts` | modified | `handleVerifyPin`, `handleAdjust`, `handleRedeem` amended |
| `src/backend/repository.ts` | comment-only | Document signed-amount convention |
| `src/constants/SocketNotifications.ts` | modified | `VERIFY_PIN`, `PIN_VERIFIED`, `ADJUST`; extended `REDEEM_FAILED` reasons |
| `MMM-Chores-Alt.css` | modified | `.adjust-button`, `.redeem-button[disabled]`, `.amount-display`, `.amount-error`, `.pin-key-dot` |
| `__tests__/unit/frontend/amount.test.ts` | new | Amount reducer, parseAmount, isMonetaryMode |
| `__tests__/unit/frontend/render.test.ts` | modified | `+` button, disabled Redeem, amount keypad shape, dot toggle |
| `__tests__/unit/backend/Backend.test.ts` | modified | Adjust, partial redeem, insufficient, verify-pin, rounding |
| `MMM-Chores-Alt.js`, `MMM-Chores-Alt.js.map`, `node_helper.js`, `node_helper.js.map` | rebuilt | `npm run build` artefacts |
