import { describe, it, expect } from "vitest"
import { todayStr } from "../../../src/backend/dateUtils"

describe("todayStr", () => {
  it("returns YYYY-MM-DD for late evening local time", () => {
    expect(todayStr(new Date(2026, 4, 9, 23, 59, 59))).toBe("2026-05-09")
  })

  it("pads single-digit month with zero", () => {
    expect(todayStr(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01")
  })

  it("handles year-end date", () => {
    expect(todayStr(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31")
  })
})
