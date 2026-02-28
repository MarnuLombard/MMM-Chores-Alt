Module.register("MMM-Chores-Alt", {

  requiresVersion: "2.25.0",

  defaults: {
    children: [
      /**
       * Example child entry:
       * {
       *   id: "child1",
       *   name: "Alice",
       *   color: "#ff6b6b",
       *   chores: [
       *     { id: "make-bed",    label: "Make Bed",    icon: "🛏️", points: 1 },
       *     { id: "brush-teeth", label: "Brush Teeth", icon: "🦷", points: 1 },
       *     { id: "tidy-room",   label: "Tidy Room",   icon: "/modules/MMM-Chores-Alt/icons/room.png", points: 2 },
       *   ]
       * }
       *
       * icon: emoji string OR image path (contains "/" or ".") → rendered as <img>
       * label: optional — omit if the icon is self-explanatory
       */
    ],
    parentPin: "0000",
  },

  start() {
    this.state = null
    this.pinChildId = null
    this.pinInput = ""
    this.sendSocketNotification("INIT", this.config)
  },

  getStyles() {
    return [this.file("MMM-Chores-Alt.css")]
  },

  getDom() {
    const wrapper = document.createElement("div")
    wrapper.className = "MMM-Chores-Alt"

    if (!this.state) {
      const loading = document.createElement("div")
      loading.className = "chores-loading"
      loading.textContent = "Loading\u2026"
      wrapper.appendChild(loading)
      return wrapper
    }

    const row = document.createElement("div")
    row.className = "chores-row"
    for (const child of this.state.children) {
      row.appendChild(this.renderChildSection(child))
    }
    wrapper.appendChild(row)

    if (this.pinChildId) {
      wrapper.appendChild(this.renderPinModal())
    }

    return wrapper
  },

  // ── Child section (inline: name → chore buttons → tally) ───────────────

  renderChildSection(child) {
    const section = document.createElement("div")
    section.className = "child-section"
    section.dataset.childId = child.id

    // Child name
    const nameEl = document.createElement("span")
    nameEl.className = "child-name"
    if (child.color) {
      nameEl.style.color = child.color
    }
    nameEl.textContent = child.name
    section.appendChild(nameEl)

    // Chore buttons (inline)
    for (const chore of child.chores) {
      section.appendChild(this.renderChoreButton(child.id, chore))
    }

    // Tally
    const tally = document.createElement("span")
    tally.className = "child-tally"
    tally.textContent = `${child.tally}pts`
    section.appendChild(tally)

    // Redeem button
    const redeemBtn = document.createElement("button")
    redeemBtn.className = "redeem-button"
    redeemBtn.textContent = "Redeem"
    redeemBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      this.openPinModal(child.id)
    })
    section.appendChild(redeemBtn)

    return section
  },

  // ── Chore button ────────────────────────────────────────────────────────

  renderChoreButton(childId, chore) {
    const btn = document.createElement("div")
    btn.className = "chore-button" + (chore.done ? " done" : "")
    btn.dataset.choreId = chore.id

    // Icon
    if (chore.icon && (chore.icon.includes("/") || chore.icon.includes("."))) {
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

    // Done badge
    if (chore.done) {
      const badge = document.createElement("div")
      badge.className = "chore-done-badge"
      badge.textContent = "\u2705"
      btn.appendChild(badge)
    }

    // Click handler
    btn.addEventListener("click", () => {
      this.sendSocketNotification("TOGGLE_CHORE", {
        childId,
        choreId: chore.id,
      })
    })

    return btn
  },

  // ── PIN modal ───────────────────────────────────────────────────────────

  openPinModal(childId) {
    this.pinChildId = childId
    this.pinInput = ""
    this.updateDom()
  },

  closePinModal() {
    if (this.pinChildId) {
      this.pinChildId = null
      this.pinInput = ""
      this.updateDom()
    }
  },

  renderPinModal() {
    const child = this.state.children.find(c => c.id === this.pinChildId)
    const childName = child ? child.name : ""

    const overlay = document.createElement("div")
    overlay.className = "pin-overlay"
    overlay.addEventListener("click", (e) => {
      e.stopPropagation()
      this.closePinModal()
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
    display.textContent = "\u2022".repeat(this.pinInput.length)
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
        btn.textContent = "\u232B"
      } else if (key === "ok") {
        btn.classList.add("pin-key-ok")
        btn.textContent = "\u2713"
      } else {
        btn.textContent = key
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        this.handlePinKey(key)
      })
      keypad.appendChild(btn)
    }
    modal.appendChild(keypad)

    const cancelBtn = document.createElement("button")
    cancelBtn.className = "pin-cancel"
    cancelBtn.textContent = "Cancel"
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      this.closePinModal()
    })
    modal.appendChild(cancelBtn)

    overlay.appendChild(modal)
    return overlay
  },

  handlePinKey(key) {
    if (key === "back") {
      this.pinInput = this.pinInput.slice(0, -1)
    } else if (key === "ok") {
      if (this.pinInput.length > 0) {
        this.sendSocketNotification("REDEEM", {
          childId: this.pinChildId,
          pin: this.pinInput,
        })
      }
      return
    } else {
      if (this.pinInput.length < 8) {
        this.pinInput += key
      }
    }
    this.updatePinDisplay()
  },

  updatePinDisplay() {
    const display = document.querySelector(".pin-display")
    if (display) {
      display.textContent = "\u2022".repeat(this.pinInput.length)
    }
    const errorEl = document.querySelector(".pin-error")
    if (errorEl) {
      errorEl.textContent = ""
    }
  },

  handleRedeemFailed(payload) {
    if (payload.reason === "wrong_pin") {
      this.pinInput = ""
      this.updatePinDisplay()
      const errorEl = document.querySelector(".pin-error")
      if (errorEl) {
        errorEl.textContent = "Wrong PIN"
      }
    } else if (payload.reason === "no_points") {
      this.closePinModal()
    }
  },

  // ── Socket notifications ────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "STATE") {
      this.state = payload
      this.pinChildId = null
      this.pinInput = ""
      this.updateDom()
    }
    if (notification === "REDEEM_FAILED") {
      this.handleRedeemFailed(payload)
    }
  },
})
