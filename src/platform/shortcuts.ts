/**
 * Page shortcuts. The desktop app uses Alt+1 to Alt+4; browsers on Linux and
 * Windows keep those for switching tabs, so the web app uses plain 1 to 4,
 * only when focus is not in a field and no modifier key is held.
 */
export function pageShortcutIndex(e: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): number | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  return /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : null
}

/** The key hint shown for page shortcut `key` ("1" to "4"). */
export function pageShortcutLabel(key: string): string {
  return key
}
