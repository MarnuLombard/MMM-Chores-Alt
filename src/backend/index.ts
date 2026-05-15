import NodeHelper from "node_helper"
import path from "node:path"
import { ChoresRepository } from "./repository"
import { createBackend } from "./Backend"

module.exports = NodeHelper.create(
  createBackend({
    repository: new ChoresRepository(path.join(__dirname, "chores.db")),
  })
)
