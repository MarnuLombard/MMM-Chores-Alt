export function isImageIcon(icon: string): boolean {
  return /[/.]/.test(icon)
}
