import { describe, it, expect, vi } from "vitest"
import {
  renderWrapper,
  renderChildSection,
  renderChoreButton,
  renderPinModal,
} from "../../../src/frontend/render"
import type { DisplayFormat } from "../../../src/types/Config"
import type { ChildState, ChoreState, StatePayload } from "../../../src/types/State"

const ptsFormat: DisplayFormat = { prefix: "", suffix: "pts" }

describe("renderWrapper", () => {
  it("renders a loading element when state is null", () => {
    const w = renderWrapper(null, ptsFormat, vi.fn(), vi.fn(), vi.fn())
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
    const w = renderWrapper(state, ptsFormat, vi.fn(), vi.fn(), vi.fn())
    expect(w.querySelectorAll(".child-section").length).toBe(2)
  })
})

describe("renderChildSection", () => {
  it("contains name, chore buttons, tally, adjust, redeem", () => {
    const child: ChildState = {
      id: "alice", name: "Alice", color: "#f0a", tally: 3,
      chores: [
        { id: "bed", icon: "🛏️", points: 1, done: false },
        { id: "teeth", icon: "🦷", points: 1, done: true },
      ],
    }
    const onChore = vi.fn()
    const onRedeem = vi.fn()
    const onAdjust = vi.fn()
    const section = renderChildSection(child, ptsFormat, onChore, onRedeem, onAdjust)
    expect(section.classList.contains("child-section")).toBe(true)
    expect(section.dataset.childId).toBe("alice")
    expect(section.querySelector(".child-name")!.textContent).toBe("Alice")
    expect(section.querySelectorAll(".chore-button").length).toBe(2)
    expect(section.querySelector(".child-tally")!.textContent).toBe("3pts")
    const redeem = section.querySelector(".redeem-button") as HTMLButtonElement
    redeem.click()
    expect(onRedeem).toHaveBeenCalledWith("alice")
  })

  it("renders tally using configured currency prefix and 2dp", () => {
    const child: ChildState = {
      id: "alice", name: "Alice", tally: 1.5,
      chores: [{ id: "bed", icon: "🛏️", points: 0.1, done: false }],
    }
    const section = renderChildSection(
      child,
      { prefix: "$", suffix: "" },
      vi.fn(),
      vi.fn(),
      vi.fn()
    )
    expect(section.querySelector(".child-tally")!.textContent).toBe("$1.50")
  })

  it("renders + button immediately to the left of Redeem and calls onAdjust on click (R1.1)", () => {
    const child: ChildState = {
      id: "alice", name: "Alice", tally: 3,
      chores: [{ id: "bed", icon: "🛏️", points: 1, done: false }],
    }
    const onAdjust = vi.fn()
    const section = renderChildSection(child, ptsFormat, vi.fn(), vi.fn(), onAdjust)
    const adjust = section.querySelector(".adjust-button") as HTMLButtonElement
    const redeem = section.querySelector(".redeem-button") as HTMLButtonElement
    expect(adjust).not.toBeNull()
    expect(redeem).not.toBeNull()
    expect(adjust.textContent).toBe("+")
    expect(adjust.compareDocumentPosition(redeem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    adjust.click()
    expect(onAdjust).toHaveBeenCalledWith("alice")
  })

  it("disables Redeem at zero tally but leaves + enabled (R2.2)", () => {
    const child: ChildState = {
      id: "eli", name: "Eli", tally: 0,
      chores: [{ id: "bed", icon: "🛏️", points: 1, done: false }],
    }
    const section = renderChildSection(child, ptsFormat, vi.fn(), vi.fn(), vi.fn())
    const redeem = section.querySelector(".redeem-button") as HTMLButtonElement
    const adjust = section.querySelector(".adjust-button") as HTMLButtonElement
    expect(redeem.hasAttribute("disabled")).toBe(true)
    expect(adjust.hasAttribute("disabled")).toBe(false)
  })

  it("does not call onRedeem when Redeem is disabled at zero tally", () => {
    const child: ChildState = {
      id: "eli", name: "Eli", tally: 0, chores: [],
    }
    const onRedeem = vi.fn()
    const section = renderChildSection(child, ptsFormat, vi.fn(), onRedeem, vi.fn())
    const redeem = section.querySelector(".redeem-button") as HTMLButtonElement
    redeem.click()
    expect(onRedeem).not.toHaveBeenCalled()
  })

  it("enables Redeem when tally > 0", () => {
    const child: ChildState = {
      id: "alice", name: "Alice", tally: 1,
      chores: [{ id: "bed", icon: "🛏️", points: 1, done: false }],
    }
    const section = renderChildSection(child, ptsFormat, vi.fn(), vi.fn(), vi.fn())
    const redeem = section.querySelector(".redeem-button") as HTMLButtonElement
    expect(redeem.hasAttribute("disabled")).toBe(false)
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

describe("renderPinModal - PIN phase", () => {
  it("contains title, display, error slot, keypad, cancel", () => {
    const onKey = vi.fn()
    const onCancel = vi.fn()
    const overlay = renderPinModal(
      "Alice",
      "12",
      { intent: "redeem", phase: "pin", monetary: false },
      onKey,
      onCancel
    )
    expect(overlay.classList.contains("pin-overlay")).toBe(true)
    expect(overlay.querySelector(".pin-title")!.textContent).toContain("Alice")
    expect(overlay.querySelector(".pin-title")!.textContent).toContain("Redeem")
    expect(overlay.querySelector(".pin-display")!.textContent).toBe("••")
    expect(overlay.querySelector(".pin-error")).not.toBeNull()
    expect(overlay.querySelectorAll(".pin-keypad .pin-key").length).toBe(12)
    expect(overlay.querySelector(".pin-key-dot")).toBeNull()
    ;(overlay.querySelector(".pin-cancel") as HTMLButtonElement).click()
    expect(onCancel).toHaveBeenCalled()
  })

  it("uses adjust title for intent=adjust (R1.2)", () => {
    const overlay = renderPinModal(
      "Alice",
      "",
      { intent: "adjust", phase: "pin", monetary: false },
      vi.fn(),
      vi.fn()
    )
    expect(overlay.querySelector(".pin-title")!.textContent).toContain("Add bonus")
    expect(overlay.querySelector(".pin-title")!.textContent).toContain("Alice")
  })
})

describe("renderPinModal - amount phase", () => {
  it("omits the decimal key when monetary=false (R3.1)", () => {
    const overlay = renderPinModal(
      "Alice",
      "1234",
      { intent: "redeem", phase: "amount", monetary: false },
      vi.fn(),
      vi.fn(),
      "3",
      3,
      ptsFormat
    )
    expect(overlay.querySelector(".pin-key-dot")).toBeNull()
    expect(overlay.querySelector(".amount-display")).not.toBeNull()
    expect(overlay.querySelectorAll(".pin-keypad .pin-key").length).toBe(12)
  })

  it("renders the decimal key when monetary=true (R3.2)", () => {
    const overlay = renderPinModal(
      "Bob",
      "1234",
      { intent: "redeem", phase: "amount", monetary: true },
      vi.fn(),
      vi.fn(),
      "1.50",
      1.5,
      { prefix: "$", suffix: "" }
    )
    expect(overlay.querySelector(".pin-key-dot")).not.toBeNull()
    expect(overlay.querySelectorAll(".pin-keypad .pin-key").length).toBe(13)
  })

  it("shows Available line for redeem and amount-error slot", () => {
    const overlay = renderPinModal(
      "Bob",
      "1234",
      { intent: "redeem", phase: "amount", monetary: true },
      vi.fn(),
      vi.fn(),
      "1.50",
      1.5,
      { prefix: "$", suffix: "" }
    )
    const display = overlay.querySelector(".amount-display")!
    expect(display.textContent).toBe("$1.50")
    expect(overlay.querySelector(".amount-available")!.textContent).toContain("$1.50")
    expect(overlay.querySelector(".amount-error")).not.toBeNull()
  })

  it("omits the Available line for adjust intent", () => {
    const overlay = renderPinModal(
      "Alice",
      "1234",
      { intent: "adjust", phase: "amount", monetary: false },
      vi.fn(),
      vi.fn(),
      "5",
      3,
      ptsFormat
    )
    expect(overlay.querySelector(".amount-available")).toBeNull()
  })

  it("preserves a trailing dot in the amount display while typing in monetary mode", () => {
    const overlay = renderPinModal(
      "Bob",
      "1234",
      { intent: "redeem", phase: "amount", monetary: true },
      vi.fn(),
      vi.fn(),
      "1.",
      1.5,
      { prefix: "$", suffix: "" }
    )
    expect(overlay.querySelector(".amount-display")!.textContent).toBe("$1.")
  })

  it("shows formatted zero in the amount display when input is empty (adjust intent)", () => {
    const overlay = renderPinModal(
      "Alice",
      "1234",
      { intent: "adjust", phase: "amount", monetary: false },
      vi.fn(),
      vi.fn(),
      "",
      0,
      ptsFormat
    )
    expect(overlay.querySelector(".amount-display")!.textContent).toBe("0pts")
  })

  it("routes digit/back/ok/dot key clicks to onKey", () => {
    const onKey = vi.fn()
    const overlay = renderPinModal(
      "Bob",
      "1234",
      { intent: "redeem", phase: "amount", monetary: true },
      onKey,
      vi.fn(),
      "1.50",
      1.5,
      { prefix: "$", suffix: "" }
    )
    ;(overlay.querySelector(".pin-key-dot") as HTMLButtonElement).click()
    expect(onKey).toHaveBeenCalledWith("dot")
  })
})
