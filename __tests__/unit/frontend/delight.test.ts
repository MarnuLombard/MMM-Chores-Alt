import { describe, it, expect, vi, beforeEach } from "vitest"
import { triggerConfetti, playChime, type DelightDeps } from "../../../src/frontend/delight"

function makeDeps(overrides: Partial<DelightDeps> = {}): DelightDeps {
  const oscCalls: unknown[] = []
  const gainCalls: unknown[] = []
  const audio = {
    currentTime: 0,
    createOscillator: vi.fn(() => {
      const osc = {
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(() => ({ connect: vi.fn() })),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscCalls.push(osc)
      return osc
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(() => ({ connect: vi.fn() })),
      }
      gainCalls.push(gain)
      return gain
    }),
    destination: {},
  }
  return {
    doc: document,
    now: () => 0,
    random: () => 0.5,
    audio,
    config: {
      delight: { sound: true, confetti: true, tallyBump: true, allDoneCelebration: true },
      sounds: { complete: null, undo: null },
    },
    ...overrides,
  }
}

describe("triggerConfetti (R28)", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  it("returns 0 and appends nothing when config.delight.confetti is false", () => {
    const deps = makeDeps({
      config: {
        delight: { sound: true, confetti: false, tallyBump: true, allDoneCelebration: true },
        sounds: { complete: null, undo: null },
      },
    })
    const target = document.createElement("div")
    document.body.appendChild(target)
    const n = triggerConfetti(deps, target)
    expect(n).toBe(0)
    expect(document.body.querySelectorAll(".confetti-particle").length).toBe(0)
  })

  it("appends 12 .confetti-particle elements by default", () => {
    const deps = makeDeps()
    const target = document.createElement("div")
    document.body.appendChild(target)
    const n = triggerConfetti(deps, target)
    expect(n).toBe(12)
    expect(document.body.querySelectorAll(".confetti-particle").length).toBe(12)
  })
})

describe("playChime (R31)", () => {
  it("returns 'skip' when sound is disabled", () => {
    const deps = makeDeps({
      config: {
        delight: { sound: false, confetti: true, tallyBump: true, allDoneCelebration: true },
        sounds: { complete: null, undo: null },
      },
    })
    expect(playChime(deps, "complete")).toBe("skip")
  })

  it("returns 'file' when a sound path is set", () => {
    const playSpy = vi.fn()
    class FakeAudio {
      preload = ""
      currentTime = 0
      constructor(_src: string) {}
      play() { playSpy(); return Promise.resolve() }
    }
    const deps = makeDeps({
      config: {
        delight: { sound: true, confetti: true, tallyBump: true, allDoneCelebration: true },
        sounds: { complete: "/tmp/x.wav", undo: null },
      },
      AudioCtor: FakeAudio as unknown as typeof Audio,
    })
    expect(playChime(deps, "complete")).toBe("file")
    expect(playSpy).toHaveBeenCalled()
  })

  it("returns 'synth' and invokes oscillator twice for kind=complete (C5+E5)", () => {
    const deps = makeDeps()
    expect(playChime(deps, "complete")).toBe("synth")
    expect((deps.audio!.createOscillator as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2)
  })
})
