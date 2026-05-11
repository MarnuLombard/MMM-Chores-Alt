import type { StatePayload } from "../types/State"
import type { Effect, ReactorSnapshot } from "../types/Effects"

export function reactToStateChange(
  _prev: ReactorSnapshot | null,
  _next: StatePayload
): { effects: Effect[], snapshot: ReactorSnapshot } {
  throw new Error("not implemented")
}
