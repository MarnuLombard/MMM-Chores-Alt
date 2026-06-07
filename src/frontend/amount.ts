export type AmountState = { input: string, error: string | null }

export type AmountDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

export type AmountAction =
  | { type: "digit", digit: AmountDigit }
  | { type: "dot" }
  | { type: "back" }
  | { type: "set", value: string }
  | { type: "failed", reason: "insufficient" }
  | { type: "reset" }

const MAX_WHOLE_DIGITS = 8
const MAX_DECIMALS = 2

export function reduceAmount(state: AmountState, action: AmountAction): AmountState {
  switch (action.type) {
    case "digit": {
      const dotIdx = state.input.indexOf(".")
      if (dotIdx === -1) {
        if (state.input.length >= MAX_WHOLE_DIGITS) return state
        return { input: state.input + action.digit, error: null }
      }
      const decimals = state.input.length - dotIdx - 1
      if (decimals >= MAX_DECIMALS) return state
      return { input: state.input + action.digit, error: null }
    }
    case "dot":
      if (state.input.includes(".")) return state
      return { input: state.input + ".", error: null }
    case "back":
      return { input: state.input.slice(0, -1), error: null }
    case "set":
      return { input: action.value, error: null }
    case "failed":
      return { input: state.input, error: "Not enough points" }
    case "reset":
      return { input: "", error: null }
  }
}

export function parseAmount(state: AmountState): number {
  if (state.input === "" || state.input === ".") return 0
  const n = Number(state.input)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function isMonetaryMode(config: { monetaryMode?: boolean }): boolean {
  return config.monetaryMode === true
}
