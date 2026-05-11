import { describe, it, expect, vi } from "vitest"
import {
  renderWrapper,
  renderChildSection,
  renderChoreButton,
  renderPinModal,
} from "../../../src/frontend/render"
import type { ChildState, ChoreState, StatePayload } from "../../../src/types/State"

describe("renderWrapper", () => {
  it("renders a loading element when state is null", () => {
    const w = renderWrapper(null, vi.fn(), vi.fn())
    expect(w.classList.contains("MMM-Chores-Alt")).toBe(true)
    expect(w.querySelector(".chores-loading")).not.toBeNull()
  })

  it("renders chores-row with one section per child", () => {
    const state: StatePayload = {
      children: [
        { id: "alice", name: "Alice", tally: 0, chores: [] },
        { id: "bob", name: "Bob", tally: 0, chores: [] },
      ],
    }
    const w = renderWrapper(state, vi.fn(), vi.fn())
    expect(w.querySelectorAll(".child-section").length).toBe(2)
  })
})

describe("renderChildSection", () => {
  it("contains name, chore buttons, tally, redeem", () => {
    const child: ChildState = {
      id: "alice", name: "Alice", color: "#f0a", tally: 3,
      chores: [
        { id: "bed", icon: "🛏️", points: 1, done: false },
        { id: "teeth", icon: "🦷", points: 1, done: true },
      ],
    }
    const onChore = vi.fn()
    const onRedeem = vi.fn()
    const section = renderChildSection(child, onChore, onRedeem)
    expect(section.classList.contains("child-section")).toBe(true)
    expect(section.dataset.childId).toBe("alice")
    expect(section.querySelector(".child-name")!.textContent).toBe("Alice")
    expect(section.querySelectorAll(".chore-button").length).toBe(2)
    expect(section.querySelector(".child-tally")!.textContent).toBe("3pts")
    const redeem = section.querySelector(".redeem-button") as HTMLButtonElement
    redeem.click()
    expect(onRedeem).toHaveBeenCalledWith("alice")
  })
})

describe("renderChoreButton", () => {
  it("renders emoji icon as text span (icon branch via isImageIcon)", () => {
    const chore: ChoreState = { id: "bed", icon: "🛏️", points: 1, done: false }
    const btn = renderChoreButton("alice", chore, vi.fn())
    const iconEl = btn.querySelector(".chore-icon") as HTMLElement
    expect(iconEl.tagName).toBe("SPAN")
    expect(iconEl.textContent).toBe("🛏️")
  })

  it("renders image path as <img>", () => {
    const chore: ChoreState = { id: "tidy", icon: "/x.png", points: 1, done: false }
    const btn = renderChoreButton("alice", chore, vi.fn())
    expect(btn.querySelector("img.chore-icon")).not.toBeNull()
  })

  it("done chore has done class and badge", () => {
    const chore: ChoreState = { id: "bed", icon: "🛏️", points: 1, done: true }
    const btn = renderChoreButton("alice", chore, vi.fn())
    expect(btn.classList.contains("done")).toBe(true)
    expect(btn.querySelector(".chore-done-badge")).not.toBeNull()
  })

  it("calls handler with childId+choreId on click", () => {
    const onClick = vi.fn()
    const chore: ChoreState = { id: "bed", icon: "🛏️", points: 1, done: false }
    const btn = renderChoreButton("alice", chore, onClick) as HTMLDivElement
    btn.click()
    expect(onClick).toHaveBeenCalledWith("alice", "bed")
  })
})

describe("renderPinModal", () => {
  it("contains title, display, error slot, keypad, cancel", () => {
    const onKey = vi.fn()
    const onCancel = vi.fn()
    const overlay = renderPinModal("Alice", "12", onKey, onCancel)
    expect(overlay.classList.contains("pin-overlay")).toBe(true)
    expect(overlay.querySelector(".pin-title")!.textContent).toContain("Alice")
    expect(overlay.querySelector(".pin-display")!.textContent).toBe("••")
    expect(overlay.querySelector(".pin-error")).not.toBeNull()
    expect(overlay.querySelectorAll(".pin-keypad .pin-key").length).toBe(12)
    ;(overlay.querySelector(".pin-cancel") as HTMLButtonElement).click()
    expect(onCancel).toHaveBeenCalled()
  })
})
