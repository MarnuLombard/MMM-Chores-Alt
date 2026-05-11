import Database from "better-sqlite3"

export interface IChoresRepository {
  isOpen(): boolean
  close(): void
  insertCompletion(date: string, childId: string, choreId: string): boolean
  deleteCompletion(date: string, childId: string, choreId: string): void
  getCompletionsForDay(date: string, childId: string): string[]
  getAllCompletions(): { childId: string, choreId: string, count: number }[]
  insertRedemption(childId: string, amount: number, redeemedAt: string): void
  getRedeemedTotal(childId: string): number
}

type Stmts = {
  insertCompletion: Database.Statement
  deleteCompletion: Database.Statement
  getCompletionsForDay: Database.Statement
  getAllCompletions: Database.Statement
  insertRedemption: Database.Statement
  getRedeemedTotal: Database.Statement
}

export class ChoresRepository implements IChoresRepository {
  private db: Database.Database
  private stmts: Stmts

  constructor(dbPath: string) {
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
      getCompletionsForDay: this.db.prepare(
        "SELECT chore_id FROM completions WHERE date = ? AND child_id = ?"
      ),
      getAllCompletions: this.db.prepare(
        "SELECT child_id, chore_id, COUNT(*) as cnt FROM completions GROUP BY child_id, chore_id"
      ),
      insertRedemption: this.db.prepare(
        "INSERT INTO redemptions (child_id, amount, redeemed_at) VALUES (?, ?, ?)"
      ),
      getRedeemedTotal: this.db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM redemptions WHERE child_id = ?"
      ),
    }
  }

  isOpen(): boolean {
    return this.db.open
  }

  close(): void {
    if (this.db.open) this.db.close()
  }

  insertCompletion(date: string, childId: string, choreId: string): boolean {
    const result = this.stmts.insertCompletion.run(date, childId, choreId)
    return result.changes > 0
  }

  deleteCompletion(date: string, childId: string, choreId: string): void {
    this.stmts.deleteCompletion.run(date, childId, choreId)
  }

  getCompletionsForDay(date: string, childId: string): string[] {
    const rows = this.stmts.getCompletionsForDay.all(date, childId) as { chore_id: string }[]
    return rows.map(r => r.chore_id)
  }

  getAllCompletions(): { childId: string, choreId: string, count: number }[] {
    const rows = this.stmts.getAllCompletions.all() as { child_id: string, chore_id: string, cnt: number }[]
    return rows.map(r => ({ childId: r.child_id, choreId: r.chore_id, count: r.cnt }))
  }

  insertRedemption(childId: string, amount: number, redeemedAt: string): void {
    this.stmts.insertRedemption.run(childId, amount, redeemedAt)
  }

  getRedeemedTotal(childId: string): number {
    const row = this.stmts.getRedeemedTotal.get(childId) as { total: number }
    return row.total
  }
}
