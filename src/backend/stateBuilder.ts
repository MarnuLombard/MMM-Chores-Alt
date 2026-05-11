import type { Config } from "../types/Config"
import type { CompletionAggregate } from "../types/Domain"
import type { StatePayload } from "../types/State"

export function buildStatePayload(
  _config: Config,
  _today: string,
  _todayCompletions: Map<string, Set<string>>,
  _allCompletions: CompletionAggregate[],
  _redeemedByChild: Map<string, number>
): StatePayload {
  throw new Error("not implemented")
}
