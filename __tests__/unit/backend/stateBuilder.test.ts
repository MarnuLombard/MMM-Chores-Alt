import { describe, it, expect } from "vitest"
import { buildStatePayload } from "../../../src/backend/stateBuilder"
import type { Config } from "../../../src/types/Config"

const config: Config = {
  parentPin: "1234",
  children: [
    {
      id: "alice",
      name: "Alice",
      color: "#f0a",
      chores: [
        { id: "bed", icon: "🛏️", points: 1 },
        { id: "teeth", icon: "🦷", points: 2, label: "Brush" },
      ],
    },
    {
      id: "bob",
      name: "Bob",
      chores: [{ id: "tidy", icon: "🧹", points: 3 }],
    },
  ],
  delight: { sound: true, confetti: true, tallyBump: true, allDoneCelebration: true },
  sounds: { complete: null, undo: null },
}

describe("buildStatePayload", () => {
  it("marks chore.done true exactly when row exists for (today, child, chore) (R11)", () => {
    const todayCompletions = new Map<string, Set<string>>([
      ["alice", new Set(["bed"])],
    ])
    const payload = buildStatePayload(
      config,
      "2026-05-09",
      todayCompletions,
      [{ childId: "alice", choreId: "bed", count: 1 }],
      new Map()
    )
    const alice = payload.children.find(c => c.id === "alice")!
    expect(alice.chores.find(c => c.id === "bed")!.done).toBe(true)
    expect(alice.chores.find(c => c.id === "teeth")!.done).toBe(false)
  })

  it("returns ChildState shape with name, color, chores, tally", () => {
    const payload = buildStatePayload(
      config,
      "2026-05-09",
      new Map(),
      [],
      new Map()
    )
    const alice = payload.children.find(c => c.id === "alice")!
    expect(alice.name).toBe("Alice")
    expect(alice.color).toBe("#f0a")
    expect(alice.chores.length).toBe(2)
    expect(alice.tally).toBe(0)
  })

  it("embeds computeTally output per child", () => {
    const payload = buildStatePayload(
      config,
      "2026-05-09",
      new Map(),
      [
        { childId: "alice", choreId: "bed", count: 3 },
        { childId: "alice", choreId: "teeth", count: 2 },
        { childId: "bob", choreId: "tidy", count: 1 },
      ],
      new Map([["alice", 2]])
    )
    expect(payload.children.find(c => c.id === "alice")!.tally).toBe(5)
    expect(payload.children.find(c => c.id === "bob")!.tally).toBe(3)
  })
})
