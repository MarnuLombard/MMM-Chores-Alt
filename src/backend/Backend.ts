import path from "node:path"
import cron from "node-cron"
import type { IChoresRepository } from "./repository"
import type { Config } from "../types/Config"
import { SocketNotification } from "../constants/SocketNotifications"
import { buildStatePayload } from "./stateBuilder"
import { todayStr } from "./dateUtils"
import { computeTally } from "./tally"

export type CronHandle = { stop: () => void }

export type BackendDeps = {
  repositoryFactory: (path: string) => IChoresRepository
  now?: () => Date
  cronSchedule?: (expr: string, handler: () => void) => CronHandle
}

export type BackendSpec = {
  name?: string
  path: string
  config: Config | null
  repository: IChoresRepository | null
  cronJob: CronHandle | null
  start: () => void
  stop: () => void
  socketNotificationReceived: (notif: string, payload: unknown) => void
  handleInit: (config: Config) => void
  handleToggle: (payload: { childId: string, choreId: string }) => void
  handleRedeem: (payload: { childId: string, pin: string }) => void
  sendState: () => void
  sendSocketNotification: (notification: string, payload: unknown) => void
  scheduleMidnightReset: () => void
}

export function createBackendSpec(deps: BackendDeps): BackendSpec {
  const now = deps.now ?? (() => new Date())
  const cronSchedule = deps.cronSchedule ?? ((expr, handler) => cron.schedule(expr, handler) as unknown as CronHandle)

  const spec: BackendSpec = {
    path: "",
    config: null,
    repository: null,
    cronJob: null,
    sendSocketNotification: () => {},

    start() {},

    stop() {
      if (this.cronJob) {
        this.cronJob.stop()
        this.cronJob = null
      }
      if (this.repository) {
        this.repository.close()
        this.repository = null
      }
    },

    socketNotificationReceived(notif, payload) {
      switch (notif) {
        case SocketNotification.INIT:
          return this.handleInit(payload as Config)
        case SocketNotification.TOGGLE_CHORE:
          return this.handleToggle(payload as { childId: string, choreId: string })
        case SocketNotification.REDEEM:
          return this.handleRedeem(payload as { childId: string, pin: string })
      }
    },

    handleInit(config) {
      this.config = config
      if (!this.repository || !this.repository.isOpen()) {
        const dbPath = path.join(this.path, "chores.db")
        this.repository = deps.repositoryFactory(dbPath)
      }
      this.scheduleMidnightReset()
      this.sendState()
    },

    handleToggle(payload) {
      if (!this.repository) return
      const date = todayStr(now())
      const inserted = this.repository.insertCompletion(date, payload.childId, payload.choreId)
      if (!inserted) {
        this.repository.deleteCompletion(date, payload.childId, payload.choreId)
      }
      this.sendState()
    },

    handleRedeem(payload) {
      if (!this.config || !this.repository) return
      const { childId, pin } = payload
      if (pin !== this.config.parentPin) {
        this.sendSocketNotification(SocketNotification.REDEEM_FAILED, { childId, reason: "wrong_pin" })
        return
      }
      const all = this.repository.getAllCompletions()
      const redeemed = this.repository.getRedeemedTotal(childId)
      const tally = computeTally(childId, this.config.children, all, redeemed)
      if (tally <= 0) {
        this.sendSocketNotification(SocketNotification.REDEEM_FAILED, { childId, reason: "no_points" })
        return
      }
      this.repository.insertRedemption(childId, tally, now().toISOString())
      this.sendState()
    },

    scheduleMidnightReset() {
      if (this.cronJob) this.cronJob.stop()
      this.cronJob = cronSchedule("0 0 * * *", () => this.sendState())
    },

    sendState() {
      if (!this.config || !this.repository) return
      const today = todayStr(now())
      const all = this.repository.getAllCompletions()
      const todayCompletions = new Map<string, Set<string>>()
      const redeemedByChild = new Map<string, number>()
      for (const child of this.config.children) {
        const ids = this.repository.getCompletionsForDay(today, child.id)
        todayCompletions.set(child.id, new Set(ids))
        redeemedByChild.set(child.id, this.repository.getRedeemedTotal(child.id))
      }
      const payload = buildStatePayload(this.config, today, todayCompletions, all, redeemedByChild)
      this.sendSocketNotification(SocketNotification.STATE, payload)
    },
  }

  return spec
}
