import cron from "node-cron";
import type { ChoresRepository } from "./repository";
import type { Config } from "../types/Config";
import { SocketNotification } from "../constants/SocketNotifications";
import { buildStatePayload } from "./stateBuilder";
import { todayStr } from "./dateUtils";
import { computeTally } from "./tally";


export type CronHandle = { stop: () => void }

export type BackendDeps = {
  repository: ChoresRepository
  now?: () => Date
  cronSchedule?: (expr: string, handler: () => void) => CronHandle
}

type TogglePayload = { childId: string, choreId: string };
type RedeemPayload = { childId: string, pin: string, amount: number };

export type Backend = {
  name?: string
  path: string
  config: Config | null
  repository: ChoresRepository
  cronJob: CronHandle | null
  start: () => void
  stop: () => void
  socketNotificationReceived: (notif: string, payload: unknown) => void
  handleInit: (config: Config) => void
  handleToggle: (payload: TogglePayload) => void
  handleRedeem: (payload: RedeemPayload) => void
  sendState: () => void
  sendSocketNotification?: (notification: string, payload: unknown) => void
  scheduleMidnightReset: () => void
}

export function createBackend(deps: BackendDeps): Backend {
  const now = deps.now ?? (() => new Date())
  const cronSchedule = deps.cronSchedule ?? ((expr, handler) => cron.schedule(expr, handler) as unknown as CronHandle)

  return {
    path: "",
    config: null,
    repository: deps.repository,
    cronJob: null,

    start() {
    },

    stop() {
      if (this.cronJob) {
        this.cronJob.stop()
        this.cronJob = null
      }
      this.repository.close()
    },

    socketNotificationReceived(notif: string, payload: unknown) {
      switch (notif) {
        case SocketNotification.INIT:
          return this.handleInit(<Config> payload)
        case SocketNotification.TOGGLE_CHORE:
          return this.handleToggle(<TogglePayload> payload)
        case SocketNotification.REDEEM:
          return this.handleRedeem(<RedeemPayload> payload)
      }
    },

    handleInit(config: Config) {
      this.config = {
        ...config,
        displayFormat: config.displayFormat ?? { prefix: "", suffix: "pts" },
      }
      this.scheduleMidnightReset()
      this.sendState()
    },

    handleToggle(payload) {
      const date = todayStr(now())
      const inserted = this.repository.insertCompletion(date, payload.childId, payload.choreId)
      if (!inserted) {
        this.repository.deleteCompletion(date, payload.childId, payload.choreId)
      }
      this.sendState()
    },

    handleRedeem(payload) {
      if (!this.config) return
      const {childId, pin} = payload
      if (pin !== this.config.parentPin) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, {childId, reason: "wrong_pin"})
        return
      }
      const all = this.repository.getAllCompletions()
      const redeemed = this.repository.getRedeemedTotal(childId)
      const tally = computeTally(childId, this.config.children, all, redeemed)
      if (tally <= 0) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, {childId, reason: "no_points"})
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
      if (!this.config) return
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
      this.sendSocketNotification?.(SocketNotification.STATE, payload)
    },
  };
}
