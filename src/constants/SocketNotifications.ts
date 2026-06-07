export enum SocketNotification {
  INIT = "INIT",
  TOGGLE_CHORE = "TOGGLE_CHORE",
  REDEEM = "REDEEM",
  STATE = "STATE",
  REDEEM_FAILED = "REDEEM_FAILED",
  VERIFY_PIN = "VERIFY_PIN",
  PIN_VERIFIED = "PIN_VERIFIED",
  ADJUST = "ADJUST",
}

export type PinIntent = "redeem" | "adjust"

export type RedeemFailedPayload = {
  childId: string
  reason: "wrong_pin" | "no_points" | "insufficient"
}

export type VerifyPinPayload = {
  childId: string
  pin: string
  intent: PinIntent
}

export type PinVerifiedPayload = {
  childId: string
  intent: PinIntent
  tally: number
}

export type AdjustPayload = {
  childId: string
  pin: string
  amount: number
}
