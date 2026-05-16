import { describe, it, expect } from "vitest"
import { formatTally } from "../../../src/frontend/formatTally"

describe("formatTally", () => {
  it("integer values render without decimals", () => {
    expect(formatTally(15, { prefix: "", suffix: "pts" })).toBe("15pts")
  })

  it("fractional values render with 2 decimal places", () => {
    expect(formatTally(1.5, { prefix: "$", suffix: "" })).toBe("$1.50")
  })

  it("rounds floating-point artefacts to 2dp", () => {
    expect(formatTally(0.1 + 0.2, { prefix: "$", suffix: "" })).toBe("$0.30")
  })

  it("handles empty prefix and suffix", () => {
    expect(formatTally(3.5, { prefix: "", suffix: "" })).toBe("3.50")
    expect(formatTally(3, { prefix: "", suffix: "" })).toBe("3")
  })

  it("zero renders as integer", () => {
    expect(formatTally(0, { prefix: "$", suffix: "" })).toBe("$0")
    expect(formatTally(0, { prefix: "", suffix: "pts" })).toBe("0pts")
  })
})
