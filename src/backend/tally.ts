import type { ChildConfig } from "../types/Config"
import type { CompletionAggregate } from "../types/Domain"

export function computeTally(
  childId: string,
  children: ChildConfig[],
  allCompletions: CompletionAggregate[],
  redeemedTotal: number
): number {
  const child = children.find(c => c.id === childId)
  if (!child) return 0
  const points = new Map(child.chores.map(c => [c.id, c.points]))
  const earned = allCompletions.reduce((sum, row) => {
    if (row.childId !== childId) return sum
    const p = points.get(row.choreId)
    if (p === undefined) return sum
    return sum + p * row.count
  }, 0)
  return Math.max(0, earned - redeemedTotal)
}
