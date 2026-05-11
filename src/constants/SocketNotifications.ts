export enum SocketNotification {
  INIT = "INIT",
  TOGGLE_CHORE = "TOGGLE_CHORE",
  REDEEM = "REDEEM",
  STATE = "STATE",
  REDEEM_FAILED = "REDEEM_FAILED",
}

export type RedeemFailedPayload = {
  childId: string
  reason: "wrong_pin" | "no_points"
}
