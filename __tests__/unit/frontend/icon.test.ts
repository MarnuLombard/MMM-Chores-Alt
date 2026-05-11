import { describe, it, expect } from "vitest"
import { isImageIcon } from "../../../src/frontend/icon"

describe("isImageIcon (AC9, R22)", () => {
  it("returns false for emoji 🛏️", () => { expect(isImageIcon("🛏️")).toBe(false) })
  it("returns false for emoji 🦷", () => { expect(isImageIcon("🦷")).toBe(false) })
  it("returns true for module-relative path", () => {
    expect(isImageIcon("/modules/MMM-Chores-Alt/icons/x.png")).toBe(true)
  })
  it("returns true for absolute URL", () => {
    expect(isImageIcon("https://example.com/icons/room.png")).toBe(true)
  })
  it("returns true for bare filename with extension", () => {
    expect(isImageIcon("teeth.png")).toBe(true)
  })
  it("returns false for empty string", () => { expect(isImageIcon("")).toBe(false) })
})
