import type { DisplayFormat } from "../types/Config"
import type { ChildState, ChoreState, StatePayload } from "../types/State"
import { formatTally } from "./formatTally"
import { isImageIcon } from "./icon"

export type ChoreHandler = (childId: string, choreId: string) => void
export type RedeemHandler = (childId: string) => void
export type PinKeyHandler = (key: string) => void
export type CancelHandler = () => void

export function renderWrapper(
  state: StatePayload | null,
  format: DisplayFormat,
  onChoreClick: ChoreHandler,
  onRedeem: RedeemHandler
): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.className = "MMM-Chores-Alt"
  if (!state) {
    const loading = document.createElement("div")
    loading.className = "chores-loading"
    loading.textContent = "Loading…"
    wrapper.appendChild(loading)
    return wrapper
  }
  const row = document.createElement("div")
  row.className = "chores-row"
  for (const child of state.children) {
    row.appendChild(renderChildSection(child, format, onChoreClick, onRedeem))
  }
  wrapper.appendChild(row)
  return wrapper
}

export function renderChildSection(
  child: ChildState,
  format: DisplayFormat,
  onChoreClick: ChoreHandler,
  onRedeem: RedeemHandler
): HTMLElement {
  const section = document.createElement("div")
  section.className = "child-section"
  section.dataset.childId = child.id

  const nameEl = document.createElement("span")
  nameEl.className = "child-name"
  if (child.color) nameEl.style.color = child.color
  nameEl.textContent = child.name
  section.appendChild(nameEl)

  for (const chore of child.chores) {
    section.appendChild(renderChoreButton(child.id, chore, onChoreClick))
  }

  const tally = document.createElement("span")
  tally.className = "child-tally"
  tally.textContent = formatTally(child.tally, format)
  section.appendChild(tally)

  const redeemBtn = document.createElement("button")
  redeemBtn.className = "redeem-button"
  redeemBtn.textContent = "Redeem"
  redeemBtn.addEventListener("click", e => {
    e.stopPropagation()
    onRedeem(child.id)
  })
  section.appendChild(redeemBtn)

  return section
}

export function renderChoreButton(
  childId: string,
  chore: ChoreState,
  onClick: ChoreHandler
): HTMLElement {
  const btn = document.createElement("div")
  btn.className = "chore-button" + (chore.done ? " done" : "")
  btn.dataset.choreId = chore.id

  if (chore.icon && isImageIcon(chore.icon)) {
    const img = document.createElement("img")
    img.className = "chore-icon"
    img.src = chore.icon
    img.alt = chore.label || chore.id
    btn.appendChild(img)
  } else {
    const emoji = document.createElement("span")
    emoji.className = "chore-icon"
    emoji.textContent = chore.icon || ""
    btn.appendChild(emoji)
  }

  if (chore.done) {
    const badge = document.createElement("div")
    badge.className = "chore-done-badge"
    badge.textContent = "✅"
    btn.appendChild(badge)
  }

  btn.addEventListener("click", () => onClick(childId, chore.id))
  return btn
}

export function renderPinModal(
  childName: string,
  pinInput: string,
  onKey: PinKeyHandler,
  onCancel: CancelHandler
): HTMLElement {
  const overlay = document.createElement("div")
  overlay.className = "pin-overlay"
  overlay.addEventListener("click", e => {
    e.stopPropagation()
    onCancel()
  })

  const modal = document.createElement("div")
  modal.className = "pin-modal"
  modal.addEventListener("click", e => e.stopPropagation())

  const title = document.createElement("div")
  title.className = "pin-title"
  title.textContent = `Redeem ${childName}'s points`
  modal.appendChild(title)

  const display = document.createElement("div")
  display.className = "pin-display"
  display.textContent = "•".repeat(pinInput.length)
  modal.appendChild(display)

  const errorEl = document.createElement("div")
  errorEl.className = "pin-error"
  modal.appendChild(errorEl)

  const keypad = document.createElement("div")
  keypad.className = "pin-keypad"
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"]
  for (const key of keys) {
    const btn = document.createElement("button")
    btn.className = "pin-key"
    if (key === "back") {
      btn.classList.add("pin-key-back")
      btn.textContent = "⌫"
    } else if (key === "ok") {
      btn.classList.add("pin-key-ok")
      btn.textContent = "✓"
    } else {
      btn.textContent = key
    }
    btn.addEventListener("click", e => {
      e.stopPropagation()
      onKey(key)
    })
    keypad.appendChild(btn)
  }
  modal.appendChild(keypad)

  const cancelBtn = document.createElement("button")
  cancelBtn.className = "pin-cancel"
  cancelBtn.textContent = "Cancel"
  cancelBtn.addEventListener("click", e => {
    e.stopPropagation()
    onCancel()
  })
  modal.appendChild(cancelBtn)

  overlay.appendChild(modal)
  return overlay
}
