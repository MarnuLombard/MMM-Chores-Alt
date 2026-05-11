import type { IChoresRepository } from "./repository"

export type BackendDeps = {
  repositoryFactory: (path: string) => IChoresRepository
  now?: () => Date
  cronSchedule?: (expr: string, handler: () => void) => { stop: () => void }
}

export function createBackendSpec(_deps: BackendDeps): unknown {
  throw new Error("not implemented")
}
