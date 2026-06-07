export type ChoreConfig = {
  id: string
  label?: string
  icon: string
  points: number
}

export type ChildConfig = {
  id: string
  name: string
  color?: string
  chores: ChoreConfig[]
}

export type DelightConfig = {
  sound: boolean
  confetti: boolean
  tallyBump: boolean
  allDoneCelebration: boolean
}

export type SoundsConfig = {
  complete: string | null
  undo: string | null
}

export type DisplayFormat = {
  prefix: string
  suffix: string
}

export type Config = {
  children: ChildConfig[]
  parentPin: string
  delight: DelightConfig
  sounds: SoundsConfig
  displayFormat: DisplayFormat
  monetaryMode?: boolean
}
