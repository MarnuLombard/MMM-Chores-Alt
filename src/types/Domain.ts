export type CompletionRow = {
  date: string
  childId: string
  choreId: string
}

export type CompletionAggregate = {
  childId: string
  choreId: string
  count: number
}

export type RedemptionRow = {
  childId: string
  amount: number
  redeemedAt: string
}
