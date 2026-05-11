export type PinState = { input: string, error: string | null }

export type PinDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

export type PinAction =
  | { type: "digit", digit: PinDigit }
  | { type: "back" }
  | { type: "submit" }
  | { type: "failed", reason: "wrong_pin" | "no_points" }
  | { type: "reset" }

export function reducePin(_state: PinState, _action: PinAction): PinState {
  throw new Error("not implemented")
}
