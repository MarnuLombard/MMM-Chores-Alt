const NodeHelper = require("node_helper")
const Log = require("logger")
const path = require("node:path")
const Database = require("better-sqlite3")
const cron = require("node-cron")

module.exports = NodeHelper.create({

  start() {
    Log.info(`[${this.name}] Helper started`)
    this.config = null
    this.db = null
    this.stmts = null
    this.cronJob = null
  },

  stop() {
    if (this.cronJob) {
      this.cronJob.stop()
    }
    if (this.db) {
      this.db.close()
      Log.info(`[${this.name}] Database closed`)
    }
  },

  async socketNotificationReceived(notification, payload) {
    if (notification === "INIT") {
      this.config = payload
      if (!this.db) {
        this.initDatabase()
      }
      this.scheduleMidnightReset()
      this.sendState()
    }

    if (notification === "TOGGLE_CHORE") {
      const { childId, choreId } = payload
      const date = this.todayStr()
      const result = this.stmts.insertCompletion.run(date, childId, choreId)
      if (result.changes === 0) {
        this.stmts.deleteCompletion.run(date, childId, choreId)
      }
      this.sendState()
    }

    if (notification === "REDEEM") {
      const { childId, pin } = payload

      if (pin !== this.config.parentPin) {
        this.sendSocketNotification("REDEEM_FAILED", { childId, reason: "wrong_pin" })
        return
      }

      const currentTally = this.computeTally(childId)
      if (currentTally <= 0) {
        this.sendSocketNotification("REDEEM_FAILED", { childId, reason: "no_points" })
        return
      }

      const now = new Date().toISOString()
      this.stmts.insertRedemption.run(childId, currentTally, now)
      Log.info(`[${this.name}] Redeemed ${currentTally} points for ${childId}`)
      this.sendState()
    }
  },

  // ── Database ──────────────────────────────────────────────────────────────

  initDatabase() {
    const dbPath = path.join(this.path, "chores.db")
    this.db = new Database(dbPath)
    this.db.pragma("journal_mode = WAL")

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS completions (
        date     TEXT NOT NULL,
        child_id TEXT NOT NULL,
        chore_id TEXT NOT NULL,
        PRIMARY KEY (date, child_id, chore_id)
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS redemptions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id    TEXT    NOT NULL,
        amount      INTEGER NOT NULL,
        redeemed_at TEXT    NOT NULL
      )
    `)

    this.stmts = {
      insertCompletion: this.db.prepare(
        "INSERT OR IGNORE INTO completions (date, child_id, chore_id) VALUES (?, ?, ?)"
      ),
      deleteCompletion: this.db.prepare(
        "DELETE FROM completions WHERE date = ? AND child_id = ? AND chore_id = ?"
      ),
      getCompletions: this.db.prepare(
        "SELECT chore_id FROM completions WHERE date = ? AND child_id = ?"
      ),
      getTotalCompleted: this.db.prepare(
        "SELECT child_id, chore_id, COUNT(*) as cnt FROM completions GROUP BY child_id, chore_id"
      ),
      getRedeemedTotal: this.db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM redemptions WHERE child_id = ?"
      ),
      insertRedemption: this.db.prepare(
        "INSERT INTO redemptions (child_id, amount, redeemed_at) VALUES (?, ?, ?)"
      ),
    }

    Log.info(`[${this.name}] Database opened at ${dbPath}`)
  },

  // ── State ─────────────────────────────────────────────────────────────────

  todayStr() {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  },

  computeTally(childId) {
    const child = this.config.children.find(c => c.id === childId)
    if (!child) return 0

    const allCompletions = this.stmts.getTotalCompleted.all()
    let totalEarned = 0
    for (const row of allCompletions) {
      if (row.child_id !== childId) continue
      const chore = child.chores.find(c => c.id === row.chore_id)
      if (chore) totalEarned += row.cnt * chore.points
    }

    const redeemedRow = this.stmts.getRedeemedTotal.get(childId)
    return totalEarned - redeemedRow.total
  },

  sendState() {
    if (!this.config || !this.db) return

    const today = this.todayStr()

    const children = this.config.children.map((child) => {
      const todayRows = this.stmts.getCompletions.all(today, child.id)
      const todayDone = new Set(todayRows.map(r => r.chore_id))

      return {
        id: child.id,
        name: child.name,
        color: child.color,
        chores: child.chores.map(chore => ({
          id: chore.id,
          label: chore.label,
          icon: chore.icon,
          points: chore.points,
          done: todayDone.has(chore.id),
        })),
        tally: this.computeTally(child.id),
      }
    })

    this.sendSocketNotification("STATE", { children })
  },

  // ── Cron ──────────────────────────────────────────────────────────────────

  scheduleMidnightReset() {
    if (this.cronJob) {
      this.cronJob.stop()
    }

    this.cronJob = cron.schedule("0 0 * * *", () => {
      Log.info(`[${this.name}] Midnight reset — sending fresh state`)
      this.sendState()
    })

    Log.info(`[${this.name}] Midnight cron scheduled`)
  },
})
