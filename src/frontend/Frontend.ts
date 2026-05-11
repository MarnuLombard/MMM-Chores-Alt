import type { Config } from "../types/Config"
import type { StatePayload } from "../types/State"
import type { ReactorSnapshot, Effect } from "../types/Effects"
import type { RedeemFailedPayload } from "../constants/SocketNotifications"
import { renderWrapper, renderPinModal } from "./render"
import { isStructurallySame, applyStateDiff } from "./stateDiff"
import { reactToStateChange } from "./stateReactor"
import { reducePin, type PinAction, type PinDigit, type PinState } from "./pin"
import {
  triggerConfetti,
  playChime,
  bumpTally,
  triggerAllDoneCelebration,
  type DelightDeps,
  type DelightAudio,
} from "./delight"

type PinModalState = { childId: string, input: string, error: string | null }

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
    config: { delight: self.config.delight, sounds: self.config.sounds },
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

function updatePinModal(self: ModuleThis, state: PinModalState) {
  const display = document.querySelector(".pin-display")
  if (display) display.textContent = "•".repeat(state.input.length)
  const errorEl = document.querySelector(".pin-error")
  if (errorEl) errorEl.textContent = state.error ?? ""
}

function applyPinAction(self: ModuleThis, action: PinAction) {
  if (!self.pinModalState) return
  const slice: PinState = { input: self.pinModalState.input, error: self.pinModalState.error }
  const reduced = reducePin(slice, action)
  self.pinModalState = { ...self.pinModalState, input: reduced.input, error: reduced.error }
  updatePinModal(self, self.pinModalState)
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
    const self = this
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
    const onRedeem = (childId: string) => {
      self.pinModalState = { childId, input: "", error: null }
      self.updateDom()
    }
    const wrapper = renderWrapper(self.state, onChoreClick, onRedeem)
    if (self.pinModalState && self.state) {
      const child = self.state.children.find(c => c.id === self.pinModalState!.childId)
      const name = child?.name ?? ""
      const onKey = (key: string) => {
        if (key === "back") {
          applyPinAction(self, { type: "back" })
        } else if (key === "ok") {
          if (self.pinModalState && self.pinModalState.input.length > 0) {
            self.sendSocketNotification("REDEEM", {
              childId: self.pinModalState.childId,
              pin: self.pinModalState.input,
            })
          }
        } else {
          applyPinAction(self, { type: "digit", digit: key as PinDigit })
        }
      }
      const onCancel = () => {
        self.pinModalState = null
        self.updateDom()
      }
      wrapper.appendChild(renderPinModal(name, self.pinModalState.input, onKey, onCancel))
    }
    return wrapper
  },

  socketNotificationReceived(this: ModuleThis, notification: string, payload: unknown) {
    if (notification === "STATE") {
      const next = payload as StatePayload
      const inPinModal = !!this.pinModalState
      const canDiff = this.state && !inPinModal && isStructurallySame(this.state, next)
      const prev = this.state
      this.state = next
      if (!inPinModal) this.pinModalState = null
      if (canDiff) {
        const wrapper = document.querySelector(".MMM-Chores-Alt")
        if (wrapper) applyStateDiff(wrapper, next)
      } else {
        this.updateDom()
      }
      const result = reactToStateChange(prev ? this.snapshot : null, next)
      this.snapshot = result.snapshot
      if (prev) dispatchEffects(this, result.effects)
    }
    if (notification === "REDEEM_FAILED") {
      const failed = payload as RedeemFailedPayload
      if (failed.reason === "wrong_pin") {
        applyPinAction(this, { type: "failed", reason: "wrong_pin" })
      } else if (failed.reason === "no_points") {
        this.pinModalState = null
        this.updateDom()
      }
    }
  },
})
