import { describe, it, expect } from "vitest"
import { computeTally } from "../../../src/backend/tally"
import type { ChildConfig } from "../../../src/types/Config"

const child: ChildConfig = {
  id: "alice",
  name: "Alice",
  chores: [
    { id: "bed", icon: "🛏️", points: 1 },
    { id: "teeth", icon: "🦷", points: 2 },
  ],
}

describe("computeTally", () => {
  it("sums completions times points", () => {
    expect(
      computeTally(
        "alice",
        [child],
        [
          { childId: "alice", choreId: "bed", count: 3 },
          { childId: "alice", choreId: "teeth", count: 2 },
        ],
        0
      )
    ).toBe(7)
  })

  it("clamps to zero when redeemed exceeds earned (R9)", () => {
    expect(
      computeTally(
        "alice",
        [child],
        [{ childId: "alice", choreId: "bed", count: 1 }],
        99
      )
    ).toBe(0)
  })

  it("ignores stale chore ids no longer in config (R10)", () => {
    expect(
      computeTally(
        "alice",
        [child],
        [{ childId: "alice", choreId: "window-washing-deprecated", count: 5 }],
        0
      )
    ).toBe(0)
  })

  it("ignores rows for other children", () => {
    expect(
      computeTally(
        "alice",
        [child],
        [{ childId: "bob", choreId: "bed", count: 10 }],
        0
      )
    ).toBe(0)
  })

  it("returns 0 for unknown child", () => {
    expect(computeTally("charlie", [child], [], 0)).toBe(0)
  })

  it("supports fractional points and redemptions", () => {
    const pocketMoney: ChildConfig = {
      id: "alice",
      name: "Alice",
      chores: [
        { id: "bed", icon: "🛏️", points: 0.1 },
        { id: "teeth", icon: "🦷", points: 0.25 },
      ],
    }
    const result = computeTally(
      "alice",
      [pocketMoney],
      [
        { childId: "alice", choreId: "bed", count: 3 },
        { childId: "alice", choreId: "teeth", count: 2 },
      ],
      0.3
    )
    expect(result).toBeCloseTo(0.5, 10)
  })
})
