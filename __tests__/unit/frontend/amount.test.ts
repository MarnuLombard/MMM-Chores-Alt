import { describe, it, expect } from "vitest"
import { reduceAmount, parseAmount, isMonetaryMode } from "../../../src/frontend/amount"

describe("reduceAmount", () => {
  it("appends a digit to empty input", () => {
    expect(reduceAmount({ input: "", error: null }, { type: "digit", digit: "1" }))
      .toEqual({ input: "1", error: null })
  })

  it("appends a digit to existing input", () => {
    expect(reduceAmount({ input: "1", error: null }, { type: "digit", digit: "2" }))
      .toEqual({ input: "12", error: null })
  })

  it("appends a dot", () => {
    expect(reduceAmount({ input: "12", error: null }, { type: "dot" }))
      .toEqual({ input: "12.", error: null })
  })

  it("ignores a second dot (R3.3)", () => {
    expect(reduceAmount({ input: "12.", error: null }, { type: "dot" }))
      .toEqual({ input: "12.", error: null })
  })

  it("appends a digit after the dot", () => {
    expect(reduceAmount({ input: "12.3", error: null }, { type: "digit", digit: "4" }))
      .toEqual({ input: "12.34", error: null })
  })

  it("caps decimals at 2 places (R3.4)", () => {
    expect(reduceAmount({ input: "12.34", error: null }, { type: "digit", digit: "5" }))
      .toEqual({ input: "12.34", error: null })
  })

  it("caps whole-number part at 8 digits (R3.4)", () => {
    expect(reduceAmount({ input: "12345678", error: null }, { type: "digit", digit: "9" }))
      .toEqual({ input: "12345678", error: null })
  })

  it("allows entering decimals after the 8-digit whole cap is reached", () => {
    const afterDot = reduceAmount({ input: "12345678", error: null }, { type: "dot" })
    expect(afterDot).toEqual({ input: "12345678.", error: null })
    expect(reduceAmount(afterDot, { type: "digit", digit: "9" }))
      .toEqual({ input: "12345678.9", error: null })
  })

  it("back removes the trailing character", () => {
    expect(reduceAmount({ input: "12", error: null }, { type: "back" }))
      .toEqual({ input: "1", error: null })
  })

  it("back on empty input is a no-op (R3.5)", () => {
    expect(reduceAmount({ input: "", error: null }, { type: "back" }))
      .toEqual({ input: "", error: null })
  })

  it("back clears any existing error", () => {
    expect(reduceAmount({ input: "5", error: "Not enough points" }, { type: "back" }))
      .toEqual({ input: "", error: null })
  })

  it("set replaces input verbatim", () => {
    expect(reduceAmount({ input: "5", error: null }, { type: "set", value: "15.00" }))
      .toEqual({ input: "15.00", error: null })
  })

  it("failed/insufficient preserves input and sets error", () => {
    expect(reduceAmount({ input: "5", error: null }, { type: "failed", reason: "insufficient" }))
      .toEqual({ input: "5", error: "Not enough points" })
  })

  it("reset clears input and error", () => {
    expect(reduceAmount({ input: "12.5", error: "Not enough points" }, { type: "reset" }))
      .toEqual({ input: "", error: null })
  })
})

describe("parseAmount", () => {
  it("returns 0 for empty input", () => {
    expect(parseAmount({ input: "", error: null })).toBe(0)
  })

  it("returns 0 for lone dot", () => {
    expect(parseAmount({ input: ".", error: null })).toBe(0)
  })

  it("parses a decimal value", () => {
    expect(parseAmount({ input: "1.50", error: null })).toBe(1.5)
  })

  it("parses a value with a single decimal", () => {
    expect(parseAmount({ input: "0.1", error: null })).toBe(0.1)
  })

  it("parses a leading-dot value as 0.x (monetary mode)", () => {
    expect(parseAmount({ input: ".5", error: null })).toBe(0.5)
  })

  it("rounds to 2 decimal places", () => {
    expect(parseAmount({ input: "1.235", error: null })).toBe(1.24)
  })
})

describe("isMonetaryMode", () => {
  it("returns true when monetaryMode is true", () => {
    expect(isMonetaryMode({ monetaryMode: true })).toBe(true)
  })

  it("returns false when monetaryMode is false", () => {
    expect(isMonetaryMode({ monetaryMode: false })).toBe(false)
  })

  it("returns false when monetaryMode is omitted", () => {
    expect(isMonetaryMode({})).toBe(false)
  })
})
