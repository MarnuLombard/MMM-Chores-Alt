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

export class ChoresRepository implements IChoresRepository {
  constructor(_dbPath: string) {
    throw new Error("not implemented")
  }

  isOpen(): boolean { throw new Error("not implemented") }
  close(): void { throw new Error("not implemented") }
  insertCompletion(_date: string, _childId: string, _choreId: string): boolean {
    throw new Error("not implemented")
  }
  deleteCompletion(_date: string, _childId: string, _choreId: string): void {
    throw new Error("not implemented")
  }
  getCompletionsForDay(_date: string, _childId: string): string[] {
    throw new Error("not implemented")
  }
  getAllCompletions(): { childId: string, choreId: string, count: number }[] {
    throw new Error("not implemented")
  }
  insertRedemption(_childId: string, _amount: number, _redeemedAt: string): void {
    throw new Error("not implemented")
  }
  getRedeemedTotal(_childId: string): number {
    throw new Error("not implemented")
  }
}
