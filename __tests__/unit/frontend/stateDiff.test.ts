import { describe, it, expect, beforeEach } from "vitest"
import { isStructurallySame, applyStateDiff } from "../../../src/frontend/stateDiff"
import type { DisplayFormat } from "../../../src/types/Config"
import type { StatePayload } from "../../../src/types/State"

const ptsFormat: DisplayFormat = { prefix: "", suffix: "pts" }

function buildDom(state: StatePayload): HTMLElement {
  const root = document.createElement("div")
  for (const child of state.children) {
    const section = document.createElement("div")
    section.className = "child-section"
    section.dataset.childId = child.id
    for (const chore of child.chores) {
      const btn = document.createElement("div")
      btn.className = "chore-button" + (chore.done ? " done" : "")
      btn.dataset.choreId = chore.id
      if (chore.done) {
        const badge = document.createElement("div")
        badge.className = "chore-done-badge"
        badge.textContent = "✅"
        btn.appendChild(badge)
      }
      section.appendChild(btn)
    }
    const tally = document.createElement("span")
    tally.className = "child-tally"
    tally.textContent = `${child.tally}pts`
    section.appendChild(tally)
    const redeem = document.createElement("button")
    redeem.className = "redeem-button"
    redeem.textContent = "Redeem"
    if (child.tally <= 0) redeem.setAttribute("disabled", "")
    section.appendChild(redeem)
    root.appendChild(section)
  }
  document.body.appendChild(root)
  return root
}

describe("isStructurallySame (R32)", () => {
  it("returns true when only tally differs", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 3, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
      { id: "teeth", icon: "x", points: 1, done: false },
    ] }] }
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 5, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
      { id: "teeth", icon: "x", points: 1, done: false },
    ] }] }
    expect(isStructurallySame(prev, next)).toBe(true)
  })

  it("returns false when chore count differs", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
      { id: "teeth", icon: "x", points: 1, done: false },
    ] }] }
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
    ] }] }
    expect(isStructurallySame(prev, next)).toBe(false)
  })

  it("returns false when child counts differ", () => {
    const prev: StatePayload = { children: [
      { id: "alice", name: "A", tally: 0, chores: [] },
      { id: "bob", name: "B", tally: 0, chores: [] },
    ] }
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [] }] }
    expect(isStructurallySame(prev, next)).toBe(false)
  })

  it("returns false when child id differs", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [] }] }
    const next: StatePayload = { children: [{ id: "bob", name: "B", tally: 0, chores: [] }] }
    expect(isStructurallySame(prev, next)).toBe(false)
  })

  it("returns false when chore id differs", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
    ] }] }
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "different", icon: "x", points: 1, done: false },
    ] }] }
    expect(isStructurallySame(prev, next)).toBe(false)
  })

  it("returns false when prev is null", () => {
    const next: StatePayload = { children: [] }
    expect(isStructurallySame(null, next)).toBe(false)
  })
})

describe("applyStateDiff (R33, R34)", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  it("toggles done class and adds badge; updates tally text", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
    ] }] }
    const root = buildDom(prev)
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 1, chores: [
      { id: "bed", icon: "x", points: 1, done: true },
    ] }] }
    const result = applyStateDiff(root, next, ptsFormat)
    expect(result).toBe(true)
    const btn = root.querySelector(".chore-button[data-chore-id='bed']")!
    expect(btn.classList.contains("done")).toBe(true)
    expect(btn.querySelector(".chore-done-badge")).not.toBeNull()
    expect(root.querySelector(".child-tally")!.textContent).toBe("1pts")
  })

  it("formats tally with configured prefix/suffix and 2dp for fractional values", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 0.1, done: false },
    ] }] }
    const root = buildDom(prev)
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 1.5, chores: [
      { id: "bed", icon: "x", points: 0.1, done: true },
    ] }] }
    applyStateDiff(root, next, { prefix: "$", suffix: "" })
    expect(root.querySelector(".child-tally")!.textContent).toBe("$1.50")
  })

  it("removes done class and badge when chore.done becomes false", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 1, chores: [
      { id: "bed", icon: "x", points: 1, done: true },
    ] }] }
    const root = buildDom(prev)
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
    ] }] }
    applyStateDiff(root, next, ptsFormat)
    const btn = root.querySelector(".chore-button[data-chore-id='bed']")!
    expect(btn.classList.contains("done")).toBe(false)
    expect(btn.querySelector(".chore-done-badge")).toBeNull()
  })

  it("enables the redeem button when tally rises above zero", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
    ] }] }
    const root = buildDom(prev)
    expect(root.querySelector(".redeem-button")!.hasAttribute("disabled")).toBe(true)
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 1, chores: [
      { id: "bed", icon: "x", points: 1, done: true },
    ] }] }
    applyStateDiff(root, next, ptsFormat)
    expect(root.querySelector(".redeem-button")!.hasAttribute("disabled")).toBe(false)
  })

  it("disables the redeem button when tally falls to zero", () => {
    const prev: StatePayload = { children: [{ id: "alice", name: "A", tally: 1, chores: [
      { id: "bed", icon: "x", points: 1, done: true },
    ] }] }
    const root = buildDom(prev)
    expect(root.querySelector(".redeem-button")!.hasAttribute("disabled")).toBe(false)
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [
      { id: "bed", icon: "x", points: 1, done: false },
    ] }] }
    applyStateDiff(root, next, ptsFormat)
    expect(root.querySelector(".redeem-button")!.hasAttribute("disabled")).toBe(true)
  })

  it("returns false when expected child-section is missing (R34)", () => {
    const root = document.createElement("div")
    document.body.appendChild(root)
    const next: StatePayload = { children: [{ id: "alice", name: "A", tally: 0, chores: [] }] }
    expect(applyStateDiff(root, next, ptsFormat)).toBe(false)
  })
})
