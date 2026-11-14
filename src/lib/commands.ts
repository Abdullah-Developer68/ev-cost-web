import type { ComponentType } from 'react'

/** One thing the command menu can do. */
export interface Command {
  id: string
  group: string
  label: string
  icon?: ComponentType<{ className?: string }>
  /** Shown after the label in a quieter weight, e.g. a work package's category. */
  detail?: string
  /** Extra words that should match a search but are not shown. */
  keywords?: string
  /** A keyboard shortcut to show on the right, e.g. "N". */
  shortcut?: string
  /** Only listed once the user types something. Keeps long lists out of the first view. */
  searchOnly?: boolean
  run: () => void
}

const WORD_START = /(^|[\s\-_/&(.,:])/

/** True when `needle`'s letters appear in `text` in order, with gaps allowed. */
function isSubsequence(needle: string, text: string): boolean {
  let at = 0
  for (const ch of needle) {
    at = text.indexOf(ch, at)
    if (at === -1) return false
    at += 1
  }
  return true
}

function scoreToken(token: string, label: string, extra: string): number {
  const inLabel = label.indexOf(token)
  if (inLabel === 0) return 100
  if (inLabel > 0) return WORD_START.test(label[inLabel - 1]) ? 80 : 60
  const inExtra = extra.indexOf(token)
  if (inExtra === 0 || (inExtra > 0 && WORD_START.test(extra[inExtra - 1]))) return 40
  if (inExtra > 0) return 30
  // Typo-tolerant fallback ("ovrvw" finds "Overview"): the letters must appear in
  // order inside one word that starts with the same letter. Anything looser
  // matches almost every long label.
  if (token.length >= 3) {
    const words = label.split(/[^a-z0-9]+/)
    if (words.some((word) => word[0] === token[0] && isSubsequence(token, word))) return 10
  }
  return 0
}

/**
 * How well a command matches a search. 0 means it does not match.
 * Every word of the search has to match somewhere; matches at the start of the
 * label beat matches inside it, which beat matches in the hidden keywords.
 */
export function scoreCommand(command: Command, query: string): number {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 1
  const label = command.label.toLowerCase()
  const extra = `${command.detail ?? ''} ${command.keywords ?? ''}`.toLowerCase()
  let total = 0
  for (const token of tokens) {
    const score = scoreToken(token, label, extra)
    if (score === 0) return 0
    total += score
  }
  return total
}

/**
 * The commands to list for a search, best match first. With an empty search it
 * returns the everyday commands in their original order. Equal scores keep
 * their original order, so the list does not jump around as the user types.
 */
export function searchCommands(commands: Command[], query: string, limit = 50): Command[] {
  const trimmed = query.trim()
  if (!trimmed) return commands.filter((c) => !c.searchOnly).slice(0, limit)
  return commands
    .map((command, index) => ({ command, index, score: scoreCommand(command, trimmed) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.command)
}

/** Groups a flat result list by its `group`, keeping the order groups first appear in. */
export function groupCommands(commands: Command[]): Array<{ group: string; commands: Command[] }> {
  const groups: Array<{ group: string; commands: Command[] }> = []
  for (const command of commands) {
    const existing = groups.find((g) => g.group === command.group)
    if (existing) existing.commands.push(command)
    else groups.push({ group: command.group, commands: [command] })
  }
  return groups
}

/** The label for the platform's main modifier key: the Command symbol on a Mac, "Ctrl" elsewhere. */
export function modKeyLabel(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘' : 'Ctrl'
}
