import type { DisplayFormat } from "../types/Config"

export function formatTally(value: number, format: DisplayFormat): string {
  const rounded = Math.round(value * 100) / 100
  const numStr = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
  return `${format.prefix}${numStr}${format.suffix}`
}
