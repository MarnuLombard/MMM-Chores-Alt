export type Effect =
  | { kind: "tally-bump", childId: string, delta: number }
  | { kind: "tally-dim", childId: string }
  | { kind: "all-done", childId: string, color?: string }

export type ReactorSnapshot = {
  tallies: Record<string, number>
  allDone: Record<string, boolean>
}
