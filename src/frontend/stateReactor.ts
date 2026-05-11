import type { StatePayload } from "../types/State"
import type { Effect, ReactorSnapshot } from "../types/Effects"

export function reactToStateChange(
  prev: ReactorSnapshot | null,
  next: StatePayload
): { effects: Effect[], snapshot: ReactorSnapshot } {
  const tallies: Record<string, number> = {}
  const allDone: Record<string, boolean> = {}
  for (const child of next.children) {
    tallies[child.id] = child.tally
    allDone[child.id] = child.chores.length > 0 && child.chores.every(c => c.done)
  }

  if (prev === null) {
    return { effects: [], snapshot: { tallies, allDone } }
  }

  const effects: Effect[] = []
  for (const child of next.children) {
    const prevTally = prev.tallies[child.id] ?? 0
    const nextTally = tallies[child.id]
    if (nextTally > prevTally) {
      effects.push({ kind: "tally-bump", childId: child.id, delta: nextTally - prevTally })
    } else if (nextTally < prevTally) {
      effects.push({ kind: "tally-dim", childId: child.id })
    }
    const wasAllDone = prev.allDone[child.id] ?? false
    if (!wasAllDone && allDone[child.id]) {
      effects.push({ kind: "all-done", childId: child.id, color: child.color })
    }
  }

  return { effects, snapshot: { tallies, allDone } }
}
