import { describe, it, expect, vi, beforeEach } from "vitest"
import { triggerConfetti, playChime, bumpTally, triggerAllDoneCelebration, type DelightDeps } from "../../../src/frontend/delight"
import type { ChildState } from "../../../src/types/State"

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

function setupSection(childId: string): HTMLElement {
  const section = document.createElement("div")
  section.className = "child-section"
  section.dataset.childId = childId
  const tally = document.createElement("span")
  tally.className = "child-tally"
  tally.textContent = "0pts"
  section.appendChild(tally)
  document.body.appendChild(section)
  return section
}

describe("bumpTally (R29)", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  it("positive delta: adds 'bumping' class and creates +N float", () => {
    setupSection("alice")
    const deps = makeDeps()
    bumpTally(deps, "alice", 2)
    const tally = document.querySelector(".child-tally")!
    expect(tally.classList.contains("bumping")).toBe(true)
    expect(document.body.querySelector(".tally-float")!.textContent).toBe("+2")
  })

  it("negative delta: adds 'dimming' class, no float element", () => {
    setupSection("alice")
    const deps = makeDeps()
    bumpTally(deps, "alice", -1)
    const tally = document.querySelector(".child-tally")!
    expect(tally.classList.contains("dimming")).toBe(true)
    expect(document.body.querySelector(".tally-float")).toBeNull()
  })

  it("zero delta: no-op", () => {
    setupSection("alice")
    const deps = makeDeps()
    bumpTally(deps, "alice", 0)
    const tally = document.querySelector(".child-tally")!
    expect(tally.classList.contains("bumping")).toBe(false)
    expect(tally.classList.contains("dimming")).toBe(false)
    expect(document.body.querySelector(".tally-float")).toBeNull()
  })

  it("missing section: no throw", () => {
    const deps = makeDeps()
    expect(() => bumpTally(deps, "ghost", 1)).not.toThrow()
  })
})

describe("triggerAllDoneCelebration (R30)", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.useFakeTimers()
  })

  it("removes 'all-done' class after 3s", () => {
    const section = setupSection("alice")
    const child: ChildState = { id: "alice", name: "Alice", tally: 5, chores: [
      { id: "bed", icon: "x", points: 1, done: true },
    ] }
    const deps = makeDeps()
    triggerAllDoneCelebration(deps, child)
    expect(section.classList.contains("all-done")).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(section.classList.contains("all-done")).toBe(false)
    vi.useRealTimers()
  })
})
