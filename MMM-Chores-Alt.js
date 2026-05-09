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
    delight: {
      sound: true,
      confetti: true,
      tallyBump: true,
      allDoneCelebration: true,
    },
    sounds: {
      complete: null,
      undo: null,
    },
  },

  start() {
    this.state = null
    this.pinChildId = null
    this.pinInput = ""
    this.prevTallies = {}
    this.allDoneState = {}
    this.audioCtx = null
    this.audioCache = {}
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
      const wasDone = btn.classList.contains("done")
      this.popChore(btn)
      if (!wasDone) {
        this.playChime("complete")
        this.triggerConfetti(btn)
      } else {
        this.playChime("undo")
      }
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

  // ── Delight: pop animation ──────────────────────────────────────────────

  popChore(btn) {
    if (btn.classList.contains("popping")) {
      btn.classList.remove("popping")
      void btn.offsetWidth
    }
    btn.classList.add("popping")
    btn.addEventListener("animationend", function onEnd(e) {
      if (e.animationName === "chore-squish-pop") {
        btn.classList.remove("popping")
        btn.removeEventListener("animationend", onEnd)
      }
    })
  },

  // ── Delight: sound (synth + optional file) ──────────────────────────────

  ensureAudioCtx() {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx) this.audioCtx = new Ctx()
    }
    return this.audioCtx
  },

  playChime(kind) {
    if (!this.config.delight || !this.config.delight.sound) return
    const filePath = this.config.sounds && this.config.sounds[kind]
    if (filePath) {
      this.playAudioFile(filePath)
      return
    }
    this.playSynthChime(kind)
  },

  playSynthChime(kind) {
    const ctx = this.ensureAudioCtx()
    if (!ctx) return
    const now = ctx.currentTime
    if (kind === "complete") {
      // Ascending major third: C5 → E5
      this.synthNote(523.25, now, 0.10, 0.16)
      this.synthNote(659.25, now + 0.07, 0.16, 0.18)
    } else if (kind === "fanfare") {
      // C major arpeggio: C5 → E5 → G5 → C6
      this.synthNote(523.25, now, 0.10, 0.18)
      this.synthNote(659.25, now + 0.07, 0.10, 0.18)
      this.synthNote(783.99, now + 0.14, 0.10, 0.18)
      this.synthNote(1046.5, now + 0.21, 0.26, 0.20)
    } else {
      // Soft G4 for undo
      this.synthNote(392.0, now, 0.20, 0.10)
    }
  },

  synthNote(freq, startTime, duration, peakGain) {
    const ctx = this.audioCtx
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.05)
  },

  playAudioFile(path) {
    let el = this.audioCache[path]
    if (!el) {
      el = new Audio(path)
      el.preload = "auto"
      this.audioCache[path] = el
    }
    try {
      el.currentTime = 0
      const playPromise = el.play()
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {})
      }
    } catch {
      // ignore: rapid re-plays can throw on some browsers
    }
  },

  // ── Delight: confetti ───────────────────────────────────────────────────

  triggerConfetti(targetEl, opts = {}) {
    if (!this.config.delight || !this.config.delight.confetti) return
    const rect = targetEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const count = opts.count || 12
    const minDist = opts.minDistance || 70
    const maxDist = opts.maxDistance || 120
    const palette = opts.palette || [
      "#ff6b6b", "#ffd93d", "#6bcf7f",
      "#4ecdc4", "#a78bfa", "#ff9f4a",
    ]
    const shapes = ["", "shape-circle", "shape-strip"]

    for (let i = 0; i < count; i++) {
      const p = document.createElement("span")
      p.className = "confetti-particle"
      const shape = shapes[Math.floor(Math.random() * shapes.length)]
      if (shape) p.classList.add(shape)
      const angle = Math.random() * 360
      const distance = minDist + Math.random() * (maxDist - minDist)
      const color = palette[Math.floor(Math.random() * palette.length)]
      const duration = 600 + Math.random() * 320
      const rot = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540)
      p.style.left = `${cx - 5}px`
      p.style.top = `${cy - 5}px`
      p.style.setProperty("--angle", `${angle}deg`)
      p.style.setProperty("--distance", `${distance}px`)
      p.style.setProperty("--color", color)
      p.style.setProperty("--duration", `${duration}ms`)
      p.style.setProperty("--rot", `${rot}deg`)
      p.addEventListener("animationend", () => p.remove())
      document.body.appendChild(p)
    }
  },

  // ── Delight: tally bump + floating +N ───────────────────────────────────

  bumpTally(childId, delta) {
    if (!this.config.delight || !this.config.delight.tallyBump) return
    const section = document.querySelector(
      `.child-section[data-child-id="${CSS.escape(childId)}"]`
    )
    if (!section) return
    const tallyEl = section.querySelector(".child-tally")
    if (!tallyEl) return

    if (delta > 0) {
      tallyEl.classList.remove("bumping")
      void tallyEl.offsetWidth
      tallyEl.classList.add("bumping")
      tallyEl.addEventListener("animationend", function onEnd(e) {
        if (e.animationName === "tally-bump") {
          tallyEl.classList.remove("bumping")
          tallyEl.removeEventListener("animationend", onEnd)
        }
      })

      const rect = tallyEl.getBoundingClientRect()
      const float = document.createElement("span")
      float.className = "tally-float"
      float.textContent = `+${delta}`
      float.style.left = `${rect.left + rect.width / 2 - 12}px`
      float.style.top = `${rect.top - 8}px`
      float.addEventListener("animationend", () => float.remove())
      document.body.appendChild(float)
    } else if (delta < 0) {
      tallyEl.classList.remove("dimming")
      void tallyEl.offsetWidth
      tallyEl.classList.add("dimming")
      tallyEl.addEventListener("animationend", function onEnd(e) {
        if (e.animationName === "tally-dim") {
          tallyEl.classList.remove("dimming")
          tallyEl.removeEventListener("animationend", onEnd)
        }
      })
    }
  },

  // ── Delight: all-done celebration ───────────────────────────────────────

  triggerAllDoneCelebration(child) {
    if (!this.config.delight || !this.config.delight.allDoneCelebration) return
    const section = document.querySelector(
      `.child-section[data-child-id="${CSS.escape(child.id)}"]`
    )
    if (!section) return

    section.style.setProperty("--child-glow", child.color || "#ffd93d")
    section.classList.add("all-done")

    const rect = section.getBoundingClientRect()
    const showers = 4
    for (let i = 0; i < showers; i++) {
      const xFrac = (i + 0.5) / showers
      const fauxEl = {
        getBoundingClientRect() {
          return {
            left: rect.left + rect.width * xFrac - 10,
            top: rect.top + rect.height * 0.4,
            width: 20,
            height: 20,
          }
        },
      }
      this.triggerConfetti(fauxEl, {
        count: 14,
        minDistance: 120,
        maxDistance: 220,
      })
    }

    if (this.config.delight.sound) {
      const filePath = this.config.sounds && this.config.sounds.complete
      if (filePath) {
        this.playAudioFile(filePath)
      } else {
        this.playSynthChime("fanfare")
      }
    }

    setTimeout(() => {
      if (section.isConnected) section.classList.remove("all-done")
    }, 3000)
  },

  // ── State diff (in-place updates to preserve animations) ────────────────

  isStructurallySame(newState) {
    if (!this.state || !newState) return false
    if (this.state.children.length !== newState.children.length) return false
    for (let i = 0; i < newState.children.length; i++) {
      const oldC = this.state.children[i]
      const newC = newState.children[i]
      if (oldC.id !== newC.id) return false
      if (oldC.chores.length !== newC.chores.length) return false
      for (let j = 0; j < newC.chores.length; j++) {
        if (oldC.chores[j].id !== newC.chores[j].id) return false
      }
    }
    return true
  },

  applyStateDiff(newState) {
    for (const child of newState.children) {
      const section = document.querySelector(
        `.child-section[data-child-id="${CSS.escape(child.id)}"]`
      )
      if (!section) return false

      const buttons = section.querySelectorAll(".chore-button")
      for (let i = 0; i < child.chores.length; i++) {
        const chore = child.chores[i]
        const btn = buttons[i]
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
      if (tallyEl) tallyEl.textContent = `${child.tally}pts`
    }
    return true
  },

  reactToStateChange(newState) {
    for (const child of newState.children) {
      const prev = this.prevTallies[child.id]
      if (prev !== undefined && prev !== child.tally) {
        this.bumpTally(child.id, child.tally - prev)
      }
      this.prevTallies[child.id] = child.tally

      const isAllDone = child.chores.length > 0 && child.chores.every(c => c.done)
      const wasAllDone = !!this.allDoneState[child.id]
      if (isAllDone && !wasAllDone) {
        this.triggerAllDoneCelebration(child)
      }
      this.allDoneState[child.id] = isAllDone
    }
  },

  // ── Socket notifications ────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "STATE") {
      const isFirstState = !this.state
      const wasInPinModal = !!this.pinChildId
      const canDiff = !isFirstState && !wasInPinModal && this.isStructurallySame(payload)

      this.state = payload
      this.pinChildId = null
      this.pinInput = ""

      if (canDiff) {
        this.applyStateDiff(payload)
      } else {
        this.updateDom()
      }

      if (isFirstState) {
        for (const child of payload.children) {
          this.prevTallies[child.id] = child.tally
          const allDone = child.chores.length > 0 && child.chores.every(c => c.done)
          this.allDoneState[child.id] = allDone
        }
      } else {
        this.reactToStateChange(payload)
      }
    }
    if (notification === "REDEEM_FAILED") {
      this.handleRedeemFailed(payload)
    }
  },
})
