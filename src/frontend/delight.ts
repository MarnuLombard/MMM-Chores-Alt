import type { DelightConfig, SoundsConfig } from "../types/Config"
import type { ChildState } from "../types/State"

export type DelightAudio = {
  currentTime: number
  createOscillator: () => unknown
  createGain: () => unknown
  destination: unknown
}

export type DelightDeps = {
  doc: Document
  now: () => number
  random: () => number
  audio: DelightAudio | null
  config: { delight: DelightConfig, sounds: SoundsConfig }
  AudioCtor?: typeof Audio
}

export type ConfettiOpts = {
  count?: number
  minDistance?: number
  maxDistance?: number
  palette?: string[]
}

export function triggerConfetti(_deps: DelightDeps, _target: Element, _opts?: ConfettiOpts): number {
  throw new Error("not implemented")
}

export function playChime(_deps: DelightDeps, _kind: "complete" | "undo" | "fanfare"): "file" | "synth" | "skip" {
  throw new Error("not implemented")
}

export function bumpTally(_deps: DelightDeps, _childId: string, _delta: number): void {
  throw new Error("not implemented")
}

export function triggerAllDoneCelebration(_deps: DelightDeps, _child: ChildState): void {
  throw new Error("not implemented")
}
