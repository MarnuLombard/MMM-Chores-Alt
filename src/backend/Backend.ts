import cron from "node-cron";
import type { ChoresRepository } from "./repository";
import type { Config } from "../types/Config";
import {
  SocketNotification,
  type VerifyPinPayload,
  type AdjustPayload,
} from "../constants/SocketNotifications";
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
  handleVerifyPin: (payload: VerifyPinPayload) => void
  handleAdjust: (payload: AdjustPayload) => void
  sendState: () => void
  sendSocketNotification?: (notification: string, payload: unknown) => void
  scheduleMidnightReset: () => void
}

function roundAmount(x: number): number {
  return Math.round(x * 100) / 100
}

function isObject(p: unknown): p is Record<string, unknown> {
  return typeof p === "object" && p !== null
}

function isConfig(p: unknown): p is Config {
  return isObject(p) && typeof p.parentPin === "string" && Array.isArray(p.children)
}

function isTogglePayload(p: unknown): p is TogglePayload {
  return isObject(p) && typeof p.childId === "string" && typeof p.choreId === "string"
}

function isRedeemPayload(p: unknown): p is RedeemPayload {
  return isObject(p)
    && typeof p.childId === "string"
    && typeof p.pin === "string"
    && typeof p.amount === "number"
}

function isVerifyPinPayload(p: unknown): p is VerifyPinPayload {
  return isObject(p)
    && typeof p.childId === "string"
    && typeof p.pin === "string"
    && (p.intent === "redeem" || p.intent === "adjust")
}

function isAdjustPayload(p: unknown): p is AdjustPayload {
  return isObject(p)
    && typeof p.childId === "string"
    && typeof p.pin === "string"
    && typeof p.amount === "number"
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
          if (isConfig(payload)) this.handleInit(payload)
          return
        case SocketNotification.TOGGLE_CHORE:
          if (isTogglePayload(payload)) this.handleToggle(payload)
          return
        case SocketNotification.REDEEM:
          if (isRedeemPayload(payload)) this.handleRedeem(payload)
          return
        case SocketNotification.VERIFY_PIN:
          if (isVerifyPinPayload(payload)) this.handleVerifyPin(payload)
          return
        case SocketNotification.ADJUST:
          if (isAdjustPayload(payload)) this.handleAdjust(payload)
          return
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

    handleVerifyPin(payload) {
      if (!this.config) return
      const { childId, pin, intent } = payload
      if (pin !== this.config.parentPin) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, { childId, reason: "wrong_pin" })
        return
      }
      const all = this.repository.getAllCompletions()
      const redeemed = this.repository.getRedeemedTotal(childId)
      const tally = computeTally(childId, this.config.children, all, redeemed)
      this.sendSocketNotification?.(SocketNotification.PIN_VERIFIED, { childId, intent, tally })
    },

    handleAdjust(payload) {
      if (!this.config) return
      const { childId, pin } = payload
      if (pin !== this.config.parentPin) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, { childId, reason: "wrong_pin" })
        return
      }
      const amount = roundAmount(payload.amount)
      if (!(amount > 0)) return
      this.repository.insertRedemption(childId, -amount, now().toISOString())
      this.sendState()
    },

    handleRedeem(payload) {
      if (!this.config) return
      const { childId, pin } = payload
      if (pin !== this.config.parentPin) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, { childId, reason: "wrong_pin" })
        return
      }
      const all = this.repository.getAllCompletions()
      const redeemed = this.repository.getRedeemedTotal(childId)
      const tally = computeTally(childId, this.config.children, all, redeemed)
      if (tally <= 0) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, { childId, reason: "no_points" })
        return
      }
      const amount = roundAmount(payload.amount)
      if (!(amount > 0)) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, { childId, reason: "no_points" })
        return
      }
      if (amount > tally) {
        this.sendSocketNotification?.(SocketNotification.REDEEM_FAILED, { childId, reason: "insufficient" })
        return
      }
      this.repository.insertRedemption(childId, amount, now().toISOString())
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
