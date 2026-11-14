import { describe, expect, it } from 'vitest'
import { Command, groupCommands, modKeyLabel, scoreCommand, searchCommands } from './commands'

const noop = (): void => {}
const cmd = (id: string, group: string, label: string, extra: Partial<Command> = {}): Command => ({
  id,
  group,
  label,
  run: noop,
  ...extra
})

const COMMANDS: Command[] = [
  cmd('go-overview', 'Go to', 'Overview', { keywords: 'dashboard home' }),
  cmd('go-packages', 'Go to', 'Work packages', { keywords: 'table cost sheet' }),
  cmd('go-report', 'Go to', 'Report', { keywords: 'pdf print' }),
  cmd('new-package', 'Actions', 'New work package', { shortcut: 'N' }),
  cmd('export-csv', 'Actions', 'Export CSV', { keywords: 'download spreadsheet' }),
  cmd('theme-dark', 'Appearance', 'Dark theme', { keywords: 'night mode' }),
  cmd('pkg-1', 'Work packages', 'Sandboxed Execution & Regression Test Runner', {
    detail: 'Infrastructure & QA',
    searchOnly: true
  }),
  cmd('pkg-2', 'Work packages', 'Enterprise SSO & Role-Based Access Control', {
    detail: 'Security & Compliance',
    searchOnly: true
  })
]

const ids = (query: string): string[] => searchCommands(COMMANDS, query).map((c) => c.id)

describe('searchCommands', () => {
  it('lists the everyday commands in order when the search is empty', () => {
    expect(ids('')).toEqual([
      'go-overview',
      'go-packages',
      'go-report',
      'new-package',
      'export-csv',
      'theme-dark'
    ])
    expect(ids('   ')).toHaveLength(6)
  })

  it('only shows individual work packages once the user searches', () => {
    expect(ids('')).not.toContain('pkg-1')
    expect(ids('sandbox')).toEqual(['pkg-1'])
  })

  it('ranks a match at the start of the label above one inside it', () => {
    // "Work packages" starts with the word; "New work package" only contains it.
    expect(ids('work')).toEqual(['go-packages', 'new-package'])
    expect(ids('rep')).toEqual(['go-report'])
  })

  it('matches hidden keywords, below visible label matches', () => {
    expect(ids('pdf')).toEqual(['go-report'])
    expect(ids('night')).toEqual(['theme-dark'])
    expect(ids('download')).toEqual(['export-csv'])
  })

  it('matches a detail such as the category', () => {
    expect(ids('compliance')).toEqual(['pkg-2'])
  })

  it('needs every word to match, in any order', () => {
    expect(ids('package new')).toEqual(['new-package'])
    expect(ids('new csv')).toEqual([])
  })

  it('ignores case and surrounding spaces', () => {
    expect(ids('  EXPORT ')).toEqual(['export-csv'])
  })

  it('forgives skipped letters inside one word, for longer words only', () => {
    expect(ids('ovrvw')).toEqual(['go-overview'])
    expect(ids('zz')).toEqual([])
  })

  it('does not match letters scattered across several words', () => {
    // "test" is spelled out across "Enterprise SSO & Role-Based Access Control" and
    // "Export CSV" if gaps between words are allowed. Only the real match should show.
    expect(ids('test')).toEqual(['pkg-1'])
  })

  it('returns nothing for a search that matches nothing', () => {
    expect(ids('quantum')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchCommands(COMMANDS, '', 2).map((c) => c.id)).toEqual(['go-overview', 'go-packages'])
  })
})

describe('scoreCommand', () => {
  it('scores a prefix match highest', () => {
    const start = scoreCommand(COMMANDS[1], 'work')
    const inside = scoreCommand(COMMANDS[3], 'work')
    const keyword = scoreCommand(COMMANDS[1], 'sheet')
    expect(start).toBeGreaterThan(inside)
    expect(inside).toBeGreaterThan(keyword)
    expect(keyword).toBeGreaterThan(0)
  })
})

describe('groupCommands', () => {
  it('keeps groups in the order they first appear', () => {
    const grouped = groupCommands(searchCommands(COMMANDS, ''))
    expect(grouped.map((g) => g.group)).toEqual(['Go to', 'Actions', 'Appearance'])
    expect(grouped[0].commands).toHaveLength(3)
  })
})

describe('modKeyLabel', () => {
  it('uses the Command symbol on Apple platforms and Ctrl elsewhere', () => {
    expect(modKeyLabel('MacIntel')).toBe('⌘')
    expect(modKeyLabel('Linux x86_64')).toBe('Ctrl')
    expect(modKeyLabel('Win32')).toBe('Ctrl')
    expect(modKeyLabel('')).toBe('Ctrl')
  })
})
