import { describe, it, expect, vi } from "vitest"
import { createBackend, type Backend, type BackendDeps } from "../../../src/backend/Backend"
import { ChoresRepository } from "../../../src/backend/repository"
import type { Config } from "../../../src/types/Config"

type TestBackend<P = unknown> = Backend & {
  sendSocketNotification: ReturnType<typeof vi.fn<(notification: string, payload: P)=> void>>,
}

const baseConfig: Config = {
  parentPin: "1234",
  children: [
    {
      id: "alice",
      name: "Alice",
      chores: [
        { id: "bed", icon: "🛏️", points: 1 },
        { id: "teeth", icon: "🦷", points: 2 },
      ],
    },
  ],
  delight: { sound: true, confetti: true, tallyBump: true, allDoneCelebration: true },
  sounds: { complete: null, undo: null },
  displayFormat: { prefix: "", suffix: "pts" },
}

function makeSpec<P>(overrides?: Partial<BackendDeps>): TestBackend<P> {
  const deps: BackendDeps = {
    repository: new ChoresRepository(":memory:"),
    cronSchedule: vi.fn((_expr: string, handler: () => void) => ({ stop: vi.fn(), handler })),
    ...overrides,
  }
  const backend = createBackend(deps)
  backend.path = "/tmp/test"
  const sendSocketNotification = vi.fn()
  backend.sendSocketNotification = sendSocketNotification
  return Object.assign(backend, { sendSocketNotification })
}

describe("Backend INIT (AC2)", () => {
  it("first INIT broadcasts STATE", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "STATE",
      expect.objectContaining({ children: expect.any(Array) })
    )
  })
})

describe("Backend TOGGLE (AC3, R12)", () => {
  it("inserts on first toggle and sets done=true in STATE", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.sendSocketNotification.mockClear()
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    const calls = spec.sendSocketNotification.mock.calls
    const [notif, payload] = calls.at(-1)!
    expect(notif).toBe("STATE")
    const alice = (payload as { children: Array<{ id: string, chores: Array<{ id: string, done: boolean }> }> })
      .children.find(c => c.id === "alice")!
    expect(alice.chores.find(c => c.id === "bed")!.done).toBe(true)
  })

  it("deletes on second toggle (done=false)", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    const calls = spec.sendSocketNotification.mock.calls
    const [, payload] = calls.at(-1)!
    const alice = (payload as { children: Array<{ id: string, chores: Array<{ id: string, done: boolean }> }> })
      .children.find(c => c.id === "alice")!
    expect(alice.chores.find(c => c.id === "bed")!.done).toBe(false)
  })
})

describe("Backend REDEEM (AC4, AC5, AC6)", () => {
  it("wrong PIN emits REDEEM_FAILED { reason: 'wrong_pin' } and writes nothing (R13)", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.sendSocketNotification.mockClear()
    spec.handleRedeem({ childId: "alice", pin: "0000", amount: 1 })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "REDEEM_FAILED",
      { childId: "alice", reason: "wrong_pin" }
    )
    expect(spec.repository.getRedeemedTotal("alice")).toBe(0)
  })

  it("zero tally emits REDEEM_FAILED { reason: 'no_points' } (R14)", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.sendSocketNotification.mockClear()
    spec.handleRedeem({ childId: "alice", pin: "1234", amount: 1 })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "REDEEM_FAILED",
      { childId: "alice", reason: "no_points" }
    )
    expect(spec.repository.getRedeemedTotal("alice")).toBe(0)
  })

  it("happy path writes redemption with amount=tally and broadcasts STATE with tally=0 (R15)", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const spec = makeSpec<{ children: Array<{ id: string, tally: number }> }>({ now: () => fixed })
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.handleToggle({ childId: "alice", choreId: "teeth" })
    // tally now 3 (1 + 2)
    spec.sendSocketNotification.mockClear()
    spec.handleRedeem({ childId: "alice", pin: "1234", amount: 3 })
    expect(spec.repository.getRedeemedTotal("alice")).toBe(3)
    const calls = spec.sendSocketNotification.mock.calls
    const [notif, payload] = calls.at(-1)!
    expect(notif).toBe("STATE")
    const alice = payload.children.find(c => c.id === "alice")!
    expect(alice.tally).toBe(0)
  })

  it("partial redeem (amount < tally) writes amount and leaves residual tally (R2.4)", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const spec = makeSpec<{ children: Array<{ id: string, tally: number }> }>({ now: () => fixed })
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.handleToggle({ childId: "alice", choreId: "teeth" })
    // tally now 3 (1 + 2)
    spec.sendSocketNotification.mockClear()
    spec.handleRedeem({ childId: "alice", pin: "1234", amount: 1 })
    expect(spec.repository.getRedeemedTotal("alice")).toBe(1)
    const calls = spec.sendSocketNotification.mock.calls
    const [notif, payload] = calls.at(-1)!
    expect(notif).toBe("STATE")
    const alice = payload.children.find(c => c.id === "alice")!
    expect(alice.tally).toBe(2)
  })

  it("partial redeem in monetary mode handles decimal amounts (Scenario: Bob)", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const monetaryConfig: Config = {
      ...baseConfig,
      monetaryMode: true,
      displayFormat: { prefix: "$", suffix: "" },
      children: [
        {
          id: "bob",
          name: "Bob",
          chores: [{ id: "tidy", icon: "🧹", points: 1.5 }],
        },
      ],
    }
    const spec = makeSpec<{ children: Array<{ id: string, tally: number }> }>({ now: () => fixed })
    spec.handleInit(monetaryConfig)
    spec.handleToggle({ childId: "bob", choreId: "tidy" })
    // tally now 1.5
    spec.sendSocketNotification.mockClear()
    spec.handleRedeem({ childId: "bob", pin: "1234", amount: 1.0 })
    expect(spec.repository.getRedeemedTotal("bob")).toBe(1.0)
    const calls = spec.sendSocketNotification.mock.calls
    const [notif, payload] = calls.at(-1)!
    expect(notif).toBe("STATE")
    const bob = payload.children.find(c => c.id === "bob")!
    expect(bob.tally).toBe(0.5)
  })

  it("amount > tally emits REDEEM_FAILED insufficient and writes nothing (R2.5)", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const spec = makeSpec({ now: () => fixed })
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.handleToggle({ childId: "alice", choreId: "teeth" })
    // tally now 3
    spec.sendSocketNotification.mockClear()
    spec.handleRedeem({ childId: "alice", pin: "1234", amount: 5 })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "REDEEM_FAILED",
      { childId: "alice", reason: "insufficient" }
    )
    expect(spec.sendSocketNotification).not.toHaveBeenCalledWith("STATE", expect.anything())
    expect(spec.repository.getRedeemedTotal("alice")).toBe(0)
  })
})

describe("Backend VERIFY_PIN (Phase 5.3, R4.1)", () => {
  it("returns PIN_VERIFIED with current tally on correct PIN", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.handleToggle({ childId: "alice", choreId: "teeth" })
    spec.sendSocketNotification.mockClear()
    spec.handleVerifyPin({ childId: "alice", pin: "1234", intent: "redeem" })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "PIN_VERIFIED",
      { childId: "alice", intent: "redeem", tally: 3 }
    )
  })

  it("returns REDEEM_FAILED wrong_pin on wrong PIN and writes nothing", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.sendSocketNotification.mockClear()
    spec.handleVerifyPin({ childId: "alice", pin: "0000", intent: "adjust" })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "REDEEM_FAILED",
      { childId: "alice", reason: "wrong_pin" }
    )
    expect(spec.repository.getRedeemedTotal("alice")).toBe(0)
  })

  it("echoes intent='adjust' on success", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.sendSocketNotification.mockClear()
    spec.handleVerifyPin({ childId: "alice", pin: "1234", intent: "adjust" })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "PIN_VERIFIED",
      { childId: "alice", intent: "adjust", tally: 0 }
    )
  })
})

describe("Backend ADJUST (Phase 5.3, R1.x, R4.1)", () => {
  it("wrong PIN emits REDEEM_FAILED wrong_pin and writes nothing", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.sendSocketNotification.mockClear()
    spec.handleAdjust({ childId: "alice", pin: "0000", amount: 5 })
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "REDEEM_FAILED",
      { childId: "alice", reason: "wrong_pin" }
    )
    expect(spec.repository.getRedeemedTotal("alice")).toBe(0)
  })

  it("raises tally by amount and stores a negative redemption row", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const spec = makeSpec({ now: () => fixed })
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    spec.handleToggle({ childId: "alice", choreId: "teeth" })
    spec.sendSocketNotification.mockClear()
    spec.handleAdjust({ childId: "alice", pin: "1234", amount: 5 })
    expect(spec.repository.getRedeemedTotal("alice")).toBe(-5)
    const calls = spec.sendSocketNotification.mock.calls
    const [notif, payload] = calls.at(-1)!
    expect(notif).toBe("STATE")
    const alice = (payload as { children: Array<{ id: string, tally: number }> })
      .children.find(c => c.id === "alice")!
    expect(alice.tally).toBe(8)
  })

  it("rounds amount to 2 decimal places before storing", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const spec = makeSpec({ now: () => fixed })
    spec.handleInit(baseConfig)
    spec.handleAdjust({ childId: "alice", pin: "1234", amount: 0.1 + 0.2 })
    expect(spec.repository.getRedeemedTotal("alice")).toBe(-0.3)
  })

  it("ignores amount <= 0 (defensive: writes nothing, no STATE)", () => {
    const spec = makeSpec()
    spec.handleInit(baseConfig)
    spec.sendSocketNotification.mockClear()
    spec.handleAdjust({ childId: "alice", pin: "1234", amount: 0 })
    spec.handleAdjust({ childId: "alice", pin: "1234", amount: -5 })
    expect(spec.repository.getRedeemedTotal("alice")).toBe(0)
    expect(spec.sendSocketNotification).not.toHaveBeenCalled()
  })

  it("does not affect today's completions", () => {
    const fixed = new Date(2026, 4, 9, 12, 0, 0)
    const spec = makeSpec({ now: () => fixed })
    spec.handleInit(baseConfig)
    spec.handleToggle({ childId: "alice", choreId: "bed" })
    const before = spec.repository.getCompletionsForDay("2026-05-09", "alice")
    spec.handleAdjust({ childId: "alice", pin: "1234", amount: 5 })
    const after = spec.repository.getCompletionsForDay("2026-05-09", "alice")
    expect(after).toEqual(before)
    expect(after).toEqual(["bed"])
  })
})

describe("Backend cron (R24)", () => {
  it("midnight cron handler calls sendState", () => {
    let capturedHandler: (() => void) | null = null
    const cronStop = vi.fn()
    const spec = makeSpec({
      cronSchedule: vi.fn((_expr, handler) => {
        capturedHandler = handler
        return { stop: cronStop }
      }),
    })
    spec.handleInit(baseConfig)
    expect(capturedHandler).toBeTypeOf("function")
    spec.sendSocketNotification.mockClear()
    capturedHandler!()
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "STATE",
      expect.objectContaining({ children: expect.any(Array) })
    )
  })

  it("stop() stops the cron job", () => {
    const cronStop = vi.fn()
    const spec = makeSpec({
      cronSchedule: vi.fn(() => ({ stop: cronStop })),
    })
    spec.handleInit(baseConfig)
    spec.stop()
    expect(cronStop).toHaveBeenCalled()
  })
})
