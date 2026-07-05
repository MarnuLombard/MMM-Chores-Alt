import type { DisplayFormat } from "../types/Config"
import type { ChildState, ChoreState, StatePayload } from "../types/State"
import { formatTally } from "./formatTally"
import { isImageIcon } from "./icon"

export type ChoreHandler = (childId: string, choreId: string) => void
export type RedeemHandler = (childId: string) => void
export type AdjustHandler = (childId: string) => void
export type PinKeyHandler = (key: string) => void
export type CancelHandler = () => void

export type ModalOptions = {
  intent: "redeem" | "adjust"
  phase: "pin" | "amount"
  monetary: boolean
}

export function renderWrapper(
  state: StatePayload | null,
  format: DisplayFormat,
  onChoreClick: ChoreHandler,
  onRedeem: RedeemHandler,
  onAdjust: AdjustHandler
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
    row.appendChild(renderChildSection(child, format, onChoreClick, onRedeem, onAdjust))
  }
  wrapper.appendChild(row)
  return wrapper
}

export function renderChildSection(
  child: ChildState,
  format: DisplayFormat,
  onChoreClick: ChoreHandler,
  onRedeem: RedeemHandler,
  onAdjust: AdjustHandler
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

  const adjustBtn = document.createElement("button")
  adjustBtn.className = "adjust-button"
  adjustBtn.textContent = "+"
  adjustBtn.addEventListener("click", e => {
    e.stopPropagation()
    onAdjust(child.id)
  })
  section.appendChild(adjustBtn)

  const redeemBtn = document.createElement("button")
  redeemBtn.className = "redeem-button"
  redeemBtn.textContent = "Redeem"
  if (child.tally <= 0) redeemBtn.setAttribute("disabled", "")
  redeemBtn.addEventListener("click", e => {
    e.stopPropagation()
    if (redeemBtn.hasAttribute("disabled")) return
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
  options: ModalOptions,
  onKey: PinKeyHandler,
  onCancel: CancelHandler,
  amountInput: string = "",
  tally: number = 0,
  format: DisplayFormat = { prefix: "", suffix: "" }
): HTMLElement {
  const overlay = document.createElement("div")
  overlay.className = "pin-overlay"
  overlay.addEventListener("click", e => {
    e.stopPropagation()
    onCancel()
  })

  const modal = document.createElement("div")
  modal.className = "pin-modal"
  modal.dataset.phase = options.phase
  modal.dataset.intent = options.intent
  modal.addEventListener("click", e => e.stopPropagation())

  const title = document.createElement("div")
  title.className = "pin-title"
  title.textContent = options.intent === "adjust"
    ? `Add bonus for ${childName}`
    : `Redeem ${childName}'s points`
  modal.appendChild(title)

  if (options.phase === "pin") {
    const display = document.createElement("div")
    display.className = "pin-display"
    display.textContent = "•".repeat(pinInput.length)
    modal.appendChild(display)

    const errorEl = document.createElement("div")
    errorEl.className = "pin-error"
    modal.appendChild(errorEl)

    modal.appendChild(renderKeypad(false, onKey))
  } else {
    const display = document.createElement("div")
    display.className = "amount-display"
    display.textContent = amountInput === ""
      ? formatTally(0, format)
      : `${format.prefix}${amountInput}${format.suffix}`
    modal.appendChild(display)

    if (options.intent === "redeem") {
      const available = document.createElement("div")
      available.className = "amount-available"
      available.textContent = `Available: ${formatTally(tally, format)}`
      modal.appendChild(available)
    }

    const errorEl = document.createElement("div")
    errorEl.className = "amount-error"
    modal.appendChild(errorEl)

    modal.appendChild(renderKeypad(options.monetary, onKey))
  }

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

function renderKeypad(includeDot: boolean, onKey: PinKeyHandler): HTMLElement {
  const keypad = document.createElement("div")
  keypad.className = "pin-keypad"
  const keys: Array<{ value: string, label: string, extraClass?: string }> = [
    { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" },
    { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" },
    { value: "7", label: "7" }, { value: "8", label: "8" }, { value: "9", label: "9" },
  ]
  if (includeDot) {
    keys.push({ value: "dot", label: ".", extraClass: "pin-key-dot" })
  }
  keys.push(
    { value: "back", label: "⌫", extraClass: "pin-key-back" },
    { value: "0", label: "0" },
    { value: "ok", label: "✓", extraClass: "pin-key-ok" },
  )
  for (const key of keys) {
    const btn = document.createElement("button")
    btn.className = "pin-key"
    if (key.extraClass) btn.classList.add(key.extraClass)
    btn.textContent = key.label
    btn.addEventListener("click", e => {
      e.stopPropagation()
      onKey(key.value)
    })
    keypad.appendChild(btn)
  }
  return keypad
}
