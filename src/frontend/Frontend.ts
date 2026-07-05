import type { Config } from "../types/Config"
import type { StatePayload } from "../types/State"
import type { ReactorSnapshot, Effect } from "../types/Effects"
import {
  SocketNotification,
  type RedeemFailedPayload,
  type PinVerifiedPayload,
  type PinIntent,
} from "../constants/SocketNotifications"
import { renderWrapper, renderPinModal } from "./render"
import { isStructurallySame, applyStateDiff } from "./stateDiff"
import { reactToStateChange } from "./stateReactor"
import { reducePin, type PinAction, type PinDigit, type PinState } from "./pin"
import {
  reduceAmount,
  parseAmount,
  isMonetaryMode,
  type AmountAction,
  type AmountDigit,
  type AmountState,
} from "./amount"
import { formatTally } from "./formatTally"
import {
  triggerConfetti,
  playChime,
  bumpTally,
  triggerAllDoneCelebration,
  type DelightDeps,
  type DelightAudio,
} from "./delight"

type PinModalState = {
  childId: string
  intent: PinIntent
  phase: "pin" | "amount"
  pinInput: string
  pinError: string | null
  amountInput: string
  amountError: string | null
  verifiedPin: string | null
  committing: boolean
}

type ModuleThis = {
  name: string
  config: Config
  file: (name: string) => string
  sendSocketNotification: (n: string, p: unknown) => void
  updateDom: (delay?: number) => void
  state: StatePayload | null
  snapshot: ReactorSnapshot | null
  pinModalState: PinModalState | null
  audioCtx: DelightAudio | null
}

function ensureAudio(self: ModuleThis): DelightAudio | null {
  if (!self.audioCtx) {
    const w = window as unknown as { AudioContext?: new () => DelightAudio, webkitAudioContext?: new () => DelightAudio }
    const Ctx = w.AudioContext || w.webkitAudioContext
    if (Ctx) self.audioCtx = new Ctx()
  }
  return self.audioCtx
}

function deps(self: ModuleThis): DelightDeps {
  return {
    doc: document,
    now: () => performance.now(),
    random: Math.random,
    audio: ensureAudio(self),
    config: {
      delight: self.config.delight,
      sounds: self.config.sounds,
      displayFormat: self.config.displayFormat,
    },
  }
}

function dispatchEffects(self: ModuleThis, effects: Effect[]) {
  for (const eff of effects) {
    if (eff.kind === "tally-bump") {
      bumpTally(deps(self), eff.childId, eff.delta)
    } else if (eff.kind === "tally-dim") {
      bumpTally(deps(self), eff.childId, -1)
    } else if (eff.kind === "all-done") {
      const child = self.state?.children.find(c => c.id === eff.childId)
      if (child) triggerAllDoneCelebration(deps(self), child)
    }
  }
}

function updatePinModal(self: ModuleThis) {
  const state = self.pinModalState
  if (!state) return
  if (state.phase === "pin") {
    const display = document.querySelector(".pin-display")
    if (display) display.textContent = "•".repeat(state.pinInput.length)
    const errorEl = document.querySelector(".pin-error")
    if (errorEl) errorEl.textContent = state.pinError ?? ""
  } else {
    const format = self.config.displayFormat
    const display = document.querySelector(".amount-display")
    if (display) {
      display.textContent = state.amountInput === ""
        ? formatTally(0, format)
        : `${format.prefix}${state.amountInput}${format.suffix}`
    }
    const errorEl = document.querySelector(".amount-error")
    if (errorEl) errorEl.textContent = state.amountError ?? ""
  }
}

function applyPinAction(self: ModuleThis, action: PinAction) {
  const state = self.pinModalState
  if (!state) return
  const slice: PinState = { input: state.pinInput, error: state.pinError }
  const reduced = reducePin(slice, action)
  state.pinInput = reduced.input
  state.pinError = reduced.error
  updatePinModal(self)
}

function applyAmountAction(self: ModuleThis, action: AmountAction) {
  const state = self.pinModalState
  if (!state) return
  const slice: AmountState = { input: state.amountInput, error: state.amountError }
  const reduced = reduceAmount(slice, action)
  state.amountInput = reduced.input
  state.amountError = reduced.error
  updatePinModal(self)
}

Module.register("MMM-Chores-Alt", {
  requiresVersion: "2.25.0",

  defaults: {
    children: [],
    parentPin: "0000",
    delight: {
      sound: true,
      confetti: true,
      tallyBump: true,
      allDoneCelebration: true,
    },
    sounds: { complete: null, undo: null },
    displayFormat: { prefix: "", suffix: "pts" },
    monetaryMode: false,
  },

  start(this: ModuleThis) {
    this.state = null
    this.snapshot = null
    this.pinModalState = null
    this.audioCtx = null
    this.sendSocketNotification("INIT", this.config)
  },

  getStyles(this: ModuleThis) {
    return [this.file("MMM-Chores-Alt.css")]
  },

  getDom(this: ModuleThis) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: ModuleThis = this
    const onChoreClick = (childId: string, choreId: string) => {
      const btn = document.querySelector(
        `.child-section[data-child-id="${CSS.escape(childId)}"] .chore-button[data-chore-id="${CSS.escape(choreId)}"]`
      )
      const wasDone = btn?.classList.contains("done") ?? false
      if (!wasDone) {
        playChime(deps(self), "complete")
        if (btn) triggerConfetti(deps(self), btn)
      } else {
        playChime(deps(self), "undo")
      }
      self.sendSocketNotification("TOGGLE_CHORE", { childId, choreId })
    }
    const openModal = (childId: string, intent: PinIntent) => {
      self.pinModalState = {
        childId,
        intent,
        phase: "pin",
        pinInput: "",
        pinError: null,
        amountInput: "",
        amountError: null,
        verifiedPin: null,
        committing: false,
      }
      self.updateDom()
    }
    const onRedeem = (childId: string) => openModal(childId, "redeem")
    const onAdjust = (childId: string) => openModal(childId, "adjust")
    const wrapper = renderWrapper(self.state, self.config.displayFormat, onChoreClick, onRedeem, onAdjust)
    if (self.pinModalState && self.state) {
      const modal = self.pinModalState
      const child = self.state.children.find(c => c.id === modal.childId)
      const name = child?.name ?? ""
      const tally = child?.tally ?? 0
      const format = self.config.displayFormat
      const monetary = isMonetaryMode(self.config)
      const onKey = (key: string) => {
        if (modal.phase === "pin") {
          if (key === "back") {
            applyPinAction(self, { type: "back" })
          } else if (key === "ok") {
            if (modal.pinInput.length > 0) {
              self.sendSocketNotification(SocketNotification.VERIFY_PIN, {
                childId: modal.childId,
                pin: modal.pinInput,
                intent: modal.intent,
              })
            }
          } else {
            applyPinAction(self, { type: "digit", digit: key as PinDigit })
          }
        } else {
          if (key === "back") {
            applyAmountAction(self, { type: "back" })
          } else if (key === "dot") {
            applyAmountAction(self, { type: "dot" })
          } else if (key === "ok") {
            const amount = parseAmount({ input: modal.amountInput, error: modal.amountError })
            if (amount > 0 && modal.verifiedPin !== null) {
              modal.committing = true
              self.sendSocketNotification(
                modal.intent === "redeem" ? SocketNotification.REDEEM : SocketNotification.ADJUST,
                { childId: modal.childId, pin: modal.verifiedPin, amount }
              )
            }
          } else {
            applyAmountAction(self, { type: "digit", digit: key as AmountDigit })
          }
        }
      }
      const onCancel = () => {
        self.pinModalState = null
        self.updateDom()
      }
      wrapper.appendChild(renderPinModal(
        name,
        modal.pinInput,
        { intent: modal.intent, phase: modal.phase, monetary },
        onKey,
        onCancel,
        modal.amountInput,
        tally,
        format
      ))
    }
    return wrapper
  },

  socketNotificationReceived(this: ModuleThis, notification: string, payload: unknown) {
    if (notification === SocketNotification.STATE) {
      const next = payload as StatePayload
      const modal = this.pinModalState
      const committing = !!(modal && modal.committing)
      const inPinModal = !!modal
      const canDiff = this.state && !inPinModal && isStructurallySame(this.state, next)
      const prev = this.state
      this.state = next
      if (committing && modal) {
        if (modal.intent === "adjust") {
          const section = document.querySelector(
            `.child-section[data-child-id="${CSS.escape(modal.childId)}"]`
          )
          if (section) triggerConfetti(deps(this), section)
        }
        this.pinModalState = null
        this.updateDom()
      } else if (canDiff) {
        const wrapper = document.querySelector(".MMM-Chores-Alt")
        if (wrapper) applyStateDiff(wrapper, next, this.config.displayFormat)
      } else {
        this.updateDom()
      }
      const result = reactToStateChange(prev ? this.snapshot : null, next)
      this.snapshot = result.snapshot
      if (prev) dispatchEffects(this, result.effects)
    }
    if (notification === SocketNotification.PIN_VERIFIED) {
      const verified = payload as PinVerifiedPayload
      const modal = this.pinModalState
      if (!modal || modal.childId !== verified.childId) return
      modal.verifiedPin = modal.pinInput
      modal.phase = "amount"
      modal.pinError = null
      modal.amountError = null
      modal.amountInput = modal.intent === "redeem"
        ? formatTally(verified.tally, { prefix: "", suffix: "" })
        : ""
      this.updateDom()
    }
    if (notification === SocketNotification.REDEEM_FAILED) {
      const failed = payload as RedeemFailedPayload
      const modal = this.pinModalState
      if (!modal) return
      modal.committing = false
      if (failed.reason === "wrong_pin") {
        applyPinAction(this, { type: "failed", reason: "wrong_pin" })
      } else if (failed.reason === "insufficient") {
        applyAmountAction(this, { type: "failed", reason: "insufficient" })
      } else if (failed.reason === "no_points") {
        this.pinModalState = null
        this.updateDom()
      }
    }
  },
})
