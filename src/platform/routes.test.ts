import { describe, it, expect } from 'vitest'
import { documentTitle, hashForTab, ROUTES, tabFromHash } from './routes'
import { pageShortcutIndex, pageShortcutLabel } from './shortcuts'
import type { TabType } from '../store/useAppStore'

const TABS: TabType[] = ['dashboard', 'costs', 'actions', 'reports']

describe('hash routes', () => {
  it('maps every page to its documented hash', () => {
    expect(TABS.map(hashForTab)).toEqual(['#/overview', '#/packages', '#/actions', '#/report'])
  })

  it('round-trips every page', () => {
    for (const tab of TABS) expect(tabFromHash(hashForTab(tab))).toBe(tab)
  })

  it('accepts the forgiving spellings people type', () => {
    expect(tabFromHash('#packages')).toBe('costs')
    expect(tabFromHash('#/report/')).toBe('reports')
    expect(tabFromHash('#/ACTIONS')).toBe('actions')
    expect(tabFromHash('#/overview?from=mail')).toBe('dashboard')
  })

  it('returns null for anything that is not a page', () => {
    for (const hash of ['', '#', '#/', '#/nope', '#/overview/extra', '#/dashboard']) {
      expect(tabFromHash(hash)).toBeNull()
    }
  })

  it('has one distinct route per page', () => {
    expect(new Set(Object.values(ROUTES)).size).toBe(TABS.length)
  })

  it('titles the browser tab with the page and project', () => {
    expect(documentTitle('costs', 'Demo')).toBe('Work packages · Demo · EV-COST')
    expect(documentTitle('dashboard', null)).toBe('Overview · EV-COST')
  })
})

describe('page shortcuts', () => {
  const key = (
    k: string,
    mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>> = {}
  ): Parameters<typeof pageShortcutIndex>[0] => ({
    key: k,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods
  })

  it('maps plain 1 to 4 to the four pages', () => {
    expect(['1', '2', '3', '4'].map((k) => pageShortcutIndex(key(k)))).toEqual([0, 1, 2, 3])
  })

  it('ignores other keys and any modifier, which browsers keep for themselves', () => {
    expect(pageShortcutIndex(key('5'))).toBeNull()
    expect(pageShortcutIndex(key('0'))).toBeNull()
    expect(pageShortcutIndex(key('k'))).toBeNull()
    for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
      expect(pageShortcutIndex(key('1', { [mod]: true }))).toBeNull()
    }
  })

  it('shows the bare digit as the hint', () => {
    expect(pageShortcutLabel('3')).toBe('3')
  })
})
