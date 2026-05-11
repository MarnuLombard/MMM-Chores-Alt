import type { ChildConfig } from "../types/Config"
import type { CompletionAggregate } from "../types/Domain"

export function computeTally(
  _childId: string,
  _children: ChildConfig[],
  _allCompletions: CompletionAggregate[],
  _redeemedTotal: number
): number {
  throw new Error("not implemented")
}
