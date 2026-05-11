export type PinState = { input: string, error: string | null }

export type PinDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

export type PinAction =
  | { type: "digit", digit: PinDigit }
  | { type: "back" }
  | { type: "submit" }
  | { type: "failed", reason: "wrong_pin" | "no_points" }
  | { type: "reset" }

const PIN_MAX = 8

export function reducePin(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case "digit":
      if (state.input.length >= PIN_MAX) return state
      return { input: state.input + action.digit, error: null }
    case "back":
      return { input: state.input.slice(0, -1), error: null }
    case "submit":
      return state
    case "failed":
      return {
        input: "",
        error: action.reason === "wrong_pin" ? "Wrong PIN" : "No points to redeem",
      }
    case "reset":
      return { input: "", error: null }
  }
}
