import type { DisplayFormat } from "../types/Config"
import type { StatePayload } from "../types/State"
import { formatTally } from "./formatTally"

export function isStructurallySame(prev: StatePayload | null, next: StatePayload): boolean {
  if (!prev) return false
  if (prev.children.length !== next.children.length) return false
  for (let i = 0; i < next.children.length; i++) {
    const a = prev.children[i]
    const b = next.children[i]
    if (a.id !== b.id) return false
    if (a.chores.length !== b.chores.length) return false
    for (let j = 0; j < b.chores.length; j++) {
      if (a.chores[j].id !== b.chores[j].id) return false
    }
  }
  return true
}

export function applyStateDiff(root: Element, next: StatePayload, format: DisplayFormat): boolean {
  for (const child of next.children) {
    const section = root.querySelector(
      `.child-section[data-child-id="${CSS.escape(child.id)}"]`
    )
    if (!section) return false

    const buttons = section.querySelectorAll(".chore-button")
    for (let i = 0; i < child.chores.length; i++) {
      const chore = child.chores[i]
      const btn = buttons[i] as HTMLElement | undefined
      if (!btn) return false
      const isDone = btn.classList.contains("done")
      if (chore.done && !isDone) {
        btn.classList.add("done")
        if (!btn.querySelector(".chore-done-badge")) {
          const badge = document.createElement("div")
          badge.className = "chore-done-badge"
          badge.textContent = "✅"
          btn.appendChild(badge)
        }
      } else if (!chore.done && isDone) {
        btn.classList.remove("done")
        const badge = btn.querySelector(".chore-done-badge")
        if (badge) badge.remove()
      }
    }

    const tallyEl = section.querySelector(".child-tally")
    if (tallyEl) tallyEl.textContent = formatTally(child.tally, format)
  }
  return true
}
