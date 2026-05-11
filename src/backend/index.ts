import NodeHelper from "node_helper"
import { ChoresRepository } from "./repository"
import { createBackendSpec } from "./Backend"

module.exports = NodeHelper.create(
  createBackendSpec({
    repositoryFactory: (p: string) => new ChoresRepository(p),
  })
)
