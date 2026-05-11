import { vi, beforeAll } from 'vitest'

vi.mock('logger')

beforeAll(() => {
  Object.defineProperty(globalThis, 'AudioContext', { value: vi.fn(), writable: true, configurable: true })
  Object.defineProperty(globalThis, 'webkitAudioContext', { value: vi.fn(), writable: true, configurable: true })
  ;(globalThis as any).Log = {
    debug: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  ;(globalThis as any).Module = { register: vi.fn() }
})
