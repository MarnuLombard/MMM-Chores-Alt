export type ChoreState = {
  id: string
  label?: string
  icon: string
  points: number
  done: boolean
}

export type ChildState = {
  id: string
  name: string
  color?: string
  chores: ChoreState[]
  tally: number
}

export type StatePayload = { children: ChildState[] }
