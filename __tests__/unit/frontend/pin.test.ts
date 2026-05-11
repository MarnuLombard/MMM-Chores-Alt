import { describe, it, expect } from "vitest"
import { reducePin } from "../../../src/frontend/pin"

describe("reducePin", () => {
  it("appends a digit", () => {
    expect(reducePin({ input: "", error: null }, { type: "digit", digit: "5" }))
      .toEqual({ input: "5", error: null })
  })

  it("back removes the last digit", () => {
    expect(reducePin({ input: "12", error: null }, { type: "back" }))
      .toEqual({ input: "1", error: null })
  })

  it("caps input at 8 chars (R20)", () => {
    expect(reducePin({ input: "12345678", error: null }, { type: "digit", digit: "9" }))
      .toEqual({ input: "12345678", error: null })
  })

  it("failed/wrong_pin clears input and sets error (R21)", () => {
    expect(reducePin({ input: "0000", error: null }, { type: "failed", reason: "wrong_pin" }))
      .toEqual({ input: "", error: "Wrong PIN" })
  })

  it("failed/no_points clears input and sets error", () => {
    expect(reducePin({ input: "1234", error: null }, { type: "failed", reason: "no_points" }))
      .toEqual({ input: "", error: "No points to redeem" })
  })

  it("reset clears input and error", () => {
    expect(reducePin({ input: "0000", error: "Wrong PIN" }, { type: "reset" }))
      .toEqual({ input: "", error: null })
  })
})
