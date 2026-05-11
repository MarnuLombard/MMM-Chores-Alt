import { describe, it, expect, vi, beforeEach } from "vitest"
import { createBackendSpec, type BackendDeps } from "../../../src/backend/Backend"
import { ChoresRepository, type IChoresRepository } from "../../../src/backend/repository"
import type { Config } from "../../../src/types/Config"

type Spec = {
  start: () => void
  stop: () => void
  socketNotificationReceived: (n: string, p: unknown) => void
  handleInit: (c: Config) => void
  handleToggle: (p: { childId: string, choreId: string }) => void
  handleRedeem: (p: { childId: string, pin: string }) => void
  sendState: () => void
  sendSocketNotification: (n: string, p: unknown) => void
  repository?: IChoresRepository
  config?: Config
  cronJob?: { stop: () => void }
  path: string
}

const baseConfig: Config = {
  parentPin: "1234",
  children: [
    {
      id: "alice",
      name: "Alice",
      chores: [
        { id: "bed", icon: "🛏️", points: 1 },
        { id: "teeth", icon: "🦷", points: 2 },
      ],
    },
  ],
  delight: { sound: true, confetti: true, tallyBump: true, allDoneCelebration: true },
  sounds: { complete: null, undo: null },
}

function makeSpec(overrides?: Partial<BackendDeps>): Spec {
  const cronStops: Array<() => void> = []
  const deps: BackendDeps = {
    repositoryFactory: () => new ChoresRepository(":memory:"),
    cronSchedule: vi.fn((_expr: string, handler: () => void) => {
      const stop = vi.fn()
      cronStops.push(stop)
      // attach handler so tests can call it
      ;(stop as unknown as { handler: () => void }).handler = handler
      return { stop }
    }),
    ...overrides,
  }
  const spec = createBackendSpec(deps) as Spec
  spec.path = "/tmp/test"
  spec.sendSocketNotification = vi.fn()
  return spec
}

describe("Backend INIT (AC2)", () => {
  let spec: Spec
  beforeEach(() => { spec = makeSpec() })

  it("opens repository on first INIT (R6)", () => {
    spec.handleInit(baseConfig)
    expect(spec.repository).toBeDefined()
    expect(spec.repository!.isOpen()).toBe(true)
  })

  it("does NOT open a second repository on re-INIT (R6)", () => {
    spec.handleInit(baseConfig)
    const first = spec.repository
    spec.handleInit(baseConfig)
    expect(spec.repository).toBe(first)
  })

  it("re-INIT after stop() opens a fresh repository (R7)", () => {
    spec.handleInit(baseConfig)
    const first = spec.repository
    spec.stop()
    spec.handleInit(baseConfig)
    expect(spec.repository).not.toBe(first)
    expect(spec.repository!.isOpen()).toBe(true)
  })
})

describe("Backend cron (R24)", () => {
  it("midnight cron handler calls sendState", () => {
    let capturedHandler: (() => void) | null = null
    const cronStop = vi.fn()
    const spec = makeSpec({
      cronSchedule: vi.fn((_expr, handler) => {
        capturedHandler = handler
        return { stop: cronStop }
      }),
    })
    spec.handleInit(baseConfig)
    expect(capturedHandler).toBeTypeOf("function")
    ;(spec.sendSocketNotification as ReturnType<typeof vi.fn>).mockClear()
    capturedHandler!()
    expect(spec.sendSocketNotification).toHaveBeenCalledWith(
      "STATE",
      expect.objectContaining({ children: expect.any(Array) })
    )
  })

  it("stop() stops the cron job", () => {
    const cronStop = vi.fn()
    const spec = makeSpec({
      cronSchedule: vi.fn(() => ({ stop: cronStop })),
    })
    spec.handleInit(baseConfig)
    spec.stop()
    expect(cronStop).toHaveBeenCalled()
  })
})
