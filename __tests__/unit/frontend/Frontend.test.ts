import { describe, it, expect, vi, beforeAll } from "vitest"

type ModuleImpl = {
  defaults: { parentPin: string, delight: { sound: boolean } }
  start: () => void
  getStyles: () => string[]
  file?: (name: string) => string
}

const registerMock = vi.fn()
;(globalThis as { Module?: { register: typeof registerMock } }).Module = { register: registerMock }

beforeAll(async () => {
  await import("../../../src/frontend/Frontend")
})

describe("Frontend registration (AC10, R23)", () => {
  it("registers MMM-Chores-Alt exactly once", () => {
    const calls = registerMock.mock.calls.filter(c => c[0] === "MMM-Chores-Alt")
    expect(calls.length).toBe(1)
  })

  it("defaults.parentPin === '0000'", () => {
    const impl = registerMock.mock.calls.find(c => c[0] === "MMM-Chores-Alt")![1] as ModuleImpl
    expect(impl.defaults.parentPin).toBe("0000")
  })

  it("defaults.delight.sound === true", () => {
    const impl = registerMock.mock.calls.find(c => c[0] === "MMM-Chores-Alt")![1] as ModuleImpl
    expect(impl.defaults.delight.sound).toBe(true)
  })

  it("typeof impl.start === 'function'", () => {
    const impl = registerMock.mock.calls.find(c => c[0] === "MMM-Chores-Alt")![1] as ModuleImpl
    expect(typeof impl.start).toBe("function")
  })

  it("getStyles returns [file('MMM-Chores-Alt.css')]", () => {
    const impl = registerMock.mock.calls.find(c => c[0] === "MMM-Chores-Alt")![1] as ModuleImpl
    const ctx = { file: (name: string) => `/path/${name}` }
    const styles = impl.getStyles.call(ctx)
    expect(styles).toEqual(["/path/MMM-Chores-Alt.css"])
  })
})
