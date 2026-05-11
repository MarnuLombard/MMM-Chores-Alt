import type { DelightConfig, SoundsConfig } from "../types/Config"
import type { ChildState } from "../types/State"

export type DelightAudio = {
  currentTime: number
  createOscillator: () => DelightOscillator
  createGain: () => DelightGain
  destination: unknown
}

export type DelightOscillator = {
  type: string
  frequency: { value: number }
  connect: (target: unknown) => { connect: (target: unknown) => unknown }
  start: (time: number) => void
  stop: (time: number) => void
}

export type DelightGain = {
  gain: {
    setValueAtTime: (value: number, time: number) => void
    exponentialRampToValueAtTime: (value: number, time: number) => void
  }
  connect: (target: unknown) => { connect: (target: unknown) => unknown }
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

const DEFAULT_PALETTE = [
  "#ff6b6b", "#ffd93d", "#6bcf7f",
  "#4ecdc4", "#a78bfa", "#ff9f4a",
]
const SHAPES = ["", "shape-circle", "shape-strip"]

export function triggerConfetti(deps: DelightDeps, target: Element, opts: ConfettiOpts = {}): number {
  if (!deps.config.delight.confetti) return 0
  const rect = target.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const count = opts.count ?? 12
  const minDist = opts.minDistance ?? 70
  const maxDist = opts.maxDistance ?? 120
  const palette = opts.palette ?? DEFAULT_PALETTE

  for (let i = 0; i < count; i++) {
    const p = deps.doc.createElement("span")
    p.className = "confetti-particle"
    const shape = SHAPES[Math.floor(deps.random() * SHAPES.length)]
    if (shape) p.classList.add(shape)
    const angle = deps.random() * 360
    const distance = minDist + deps.random() * (maxDist - minDist)
    const color = palette[Math.floor(deps.random() * palette.length)]
    const duration = 600 + deps.random() * 320
    const rot = (deps.random() < 0.5 ? -1 : 1) * (360 + deps.random() * 540)
    p.style.left = `${cx - 5}px`
    p.style.top = `${cy - 5}px`
    p.style.setProperty("--angle", `${angle}deg`)
    p.style.setProperty("--distance", `${distance}px`)
    p.style.setProperty("--color", color)
    p.style.setProperty("--duration", `${duration}ms`)
    p.style.setProperty("--rot", `${rot}deg`)
    p.addEventListener("animationend", () => p.remove())
    deps.doc.body.appendChild(p)
  }
  return count
}

function synthNote(audio: DelightAudio, freq: number, startTime: number, duration: number, peakGain: number): void {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = "triangle"
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gain).connect(audio.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

export function playChime(deps: DelightDeps, kind: "complete" | "undo" | "fanfare"): "file" | "synth" | "skip" {
  if (!deps.config.delight.sound) return "skip"
  const filePath = kind === "complete"
    ? deps.config.sounds.complete
    : kind === "undo" ? deps.config.sounds.undo : null
  if (filePath) {
    const Ctor = deps.AudioCtor ?? (globalThis as { Audio?: typeof Audio }).Audio
    if (Ctor) {
      const el = new Ctor(filePath)
      try {
        el.currentTime = 0
        const p = el.play()
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as Promise<void>).catch(() => {})
        }
      } catch {
        // ignore
      }
    }
    return "file"
  }
  if (!deps.audio) return "synth"
  const t = deps.audio.currentTime
  if (kind === "complete") {
    synthNote(deps.audio, 523.25, t, 0.10, 0.16)
    synthNote(deps.audio, 659.25, t + 0.07, 0.16, 0.18)
  } else if (kind === "fanfare") {
    synthNote(deps.audio, 523.25, t, 0.10, 0.18)
    synthNote(deps.audio, 659.25, t + 0.07, 0.10, 0.18)
    synthNote(deps.audio, 783.99, t + 0.14, 0.10, 0.18)
    synthNote(deps.audio, 1046.5, t + 0.21, 0.26, 0.20)
  } else {
    synthNote(deps.audio, 392.0, t, 0.20, 0.10)
  }
  return "synth"
}

export function bumpTally(deps: DelightDeps, childId: string, delta: number): void {
  if (!deps.config.delight.tallyBump) return
  if (delta === 0) return
  const section = deps.doc.querySelector(
    `.child-section[data-child-id="${CSS.escape(childId)}"]`
  )
  if (!section) return
  const tallyEl = section.querySelector(".child-tally") as HTMLElement | null
  if (!tallyEl) return

  if (delta > 0) {
    tallyEl.classList.add("bumping")
    tallyEl.addEventListener("animationend", function onEnd() {
      tallyEl.classList.remove("bumping")
      tallyEl.removeEventListener("animationend", onEnd)
    })
    const rect = tallyEl.getBoundingClientRect()
    const float = deps.doc.createElement("span")
    float.className = "tally-float"
    float.textContent = `+${delta}`
    float.style.left = `${rect.left + rect.width / 2 - 12}px`
    float.style.top = `${rect.top - 8}px`
    float.addEventListener("animationend", () => float.remove())
    deps.doc.body.appendChild(float)
  } else {
    tallyEl.classList.add("dimming")
    tallyEl.addEventListener("animationend", function onEnd() {
      tallyEl.classList.remove("dimming")
      tallyEl.removeEventListener("animationend", onEnd)
    })
  }
}

export function triggerAllDoneCelebration(deps: DelightDeps, child: ChildState): void {
  if (!deps.config.delight.allDoneCelebration) return
  const section = deps.doc.querySelector(
    `.child-section[data-child-id="${CSS.escape(child.id)}"]`
  ) as HTMLElement | null
  if (!section) return

  section.style.setProperty("--child-glow", child.color || "#ffd93d")
  section.classList.add("all-done")

  const rect = section.getBoundingClientRect()
  const showers = 4
  for (let i = 0; i < showers; i++) {
    const xFrac = (i + 0.5) / showers
    const fauxEl = {
      getBoundingClientRect() {
        return {
          left: rect.left + rect.width * xFrac - 10,
          top: rect.top + rect.height * 0.4,
          width: 20,
          height: 20,
          right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
        } as DOMRect
      },
    } as unknown as Element
    triggerConfetti(deps, fauxEl, { count: 14, minDistance: 120, maxDistance: 220 })
  }

  if (deps.config.delight.sound) {
    playChime(deps, "fanfare")
  }

  setTimeout(() => {
    if (section.isConnected) section.classList.remove("all-done")
  }, 3000)
}
