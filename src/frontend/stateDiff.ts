import type { StatePayload } from "../types/State"

export function isStructurallySame(_prev: StatePayload | null, _next: StatePayload): boolean {
  throw new Error("not implemented")
}

export function applyStateDiff(_root: Element, _next: StatePayload): boolean {
  throw new Error("not implemented")
}
