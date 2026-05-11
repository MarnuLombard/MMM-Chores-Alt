import { describe, it, expect } from "vitest"
import { reactToStateChange } from "../../../src/frontend/stateReactor"
import type { StatePayload } from "../../../src/types/State"

const aliceAllDone: StatePayload = {
  children: [
    {
      id: "alice", name: "Alice", tally: 5,
      chores: [
        { id: "a", icon: "🛏️", points: 1, done: true },
        { id: "b", icon: "🦷", points: 1, done: true },
      ],
    },
    { id: "bob", name: "Bob", tally: 0, chores: [] },
  ],
}

describe("reactToStateChange", () => {
  it("emits tally-bump on increase (R16)", () => {
    const prev = { tallies: { alice: 3, bob: 0 }, allDone: { alice: false, bob: true } }
    const { effects } = reactToStateChange(prev, aliceAllDone)
    expect(effects).toContainEqual({ kind: "tally-bump", childId: "alice", delta: 2 })
  })

  it("emits tally-dim on decrease (R17)", () => {
    const prev = { tallies: { alice: 7, bob: 0 }, allDone: { alice: true, bob: true } }
    const { effects } = reactToStateChange(prev, aliceAllDone)
    expect(effects).toContainEqual({ kind: "tally-dim", childId: "alice" })
  })

  it("emits all-done only on transition (R18)", () => {
    const prev = { tallies: { alice: 3, bob: 0 }, allDone: { alice: false, bob: true } }
    const { effects } = reactToStateChange(prev, aliceAllDone)
    expect(effects).toContainEqual({ kind: "all-done", childId: "alice" })
  })

  it("does not re-emit all-done when already all-done", () => {
    const prev = { tallies: { alice: 5, bob: 0 }, allDone: { alice: true, bob: true } }
    const { effects } = reactToStateChange(prev, aliceAllDone)
    expect(effects.find(e => e.kind === "all-done")).toBeUndefined()
  })

  it("does not emit all-done for child with zero chores", () => {
    const next: StatePayload = {
      children: [{ id: "bob", name: "Bob", tally: 0, chores: [] }],
    }
    const prev = { tallies: { bob: 0 }, allDone: { bob: false } }
    const { effects } = reactToStateChange(prev, next)
    expect(effects.find(e => e.kind === "all-done")).toBeUndefined()
  })

  it("returns empty effects on first state (R19)", () => {
    const { effects, snapshot } = reactToStateChange(null, aliceAllDone)
    expect(effects).toEqual([])
    expect(snapshot.tallies).toEqual({ alice: 5, bob: 0 })
    expect(snapshot.allDone).toEqual({ alice: true, bob: false })
  })
})
