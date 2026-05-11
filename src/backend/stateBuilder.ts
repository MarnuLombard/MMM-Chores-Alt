import type { Config } from "../types/Config"
import type { CompletionAggregate } from "../types/Domain"
import type { StatePayload, ChildState, ChoreState } from "../types/State"
import { computeTally } from "./tally"

export function buildStatePayload(
  config: Config,
  _today: string,
  todayCompletions: Map<string, Set<string>>,
  allCompletions: CompletionAggregate[],
  redeemedByChild: Map<string, number>
): StatePayload {
  const children: ChildState[] = config.children.map(child => {
    const doneSet = todayCompletions.get(child.id) ?? new Set<string>()
    const chores: ChoreState[] = child.chores.map(c => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      points: c.points,
      done: doneSet.has(c.id),
    }))
    const tally = computeTally(
      child.id,
      config.children,
      allCompletions,
      redeemedByChild.get(child.id) ?? 0
    )
    return {
      id: child.id,
      name: child.name,
      color: child.color,
      chores,
      tally,
    }
  })
  return { children }
}
