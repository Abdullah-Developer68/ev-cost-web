import type { TabType } from '../store/useAppStore'

/**
 * Hash routes for the four pages. Hash routing needs no server rewrites, so the
 * build works from any static host and any sub-path.
 */
export const ROUTES: Record<TabType, string> = {
  dashboard: 'overview',
  costs: 'packages',
  actions: 'actions',
  reports: 'report'
}

export const PAGE_TITLES: Record<TabType, string> = {
  dashboard: 'Overview',
  costs: 'Work packages',
  actions: 'Next actions',
  reports: 'Report'
}

export const DEFAULT_TAB: TabType = 'dashboard'

/** The URL hash for a page: `#/overview`. */
export function hashForTab(tab: TabType): string {
  return `#/${ROUTES[tab]}`
}

/**
 * The page a hash points at, or null when it names none. Accepts `#/overview`,
 * `#overview` and `#/overview/`, in any letter case, ignoring a `?query`.
 */
export function tabFromHash(hash: string): TabType | null {
  const path = hash
    .replace(/^#/, '')
    .replace(/[?].*$/, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
  if (!path) return null
  const match = (Object.keys(ROUTES) as TabType[]).find((tab) => ROUTES[tab] === path)
  return match ?? null
}

/** The browser tab title for a page. */
export function documentTitle(tab: TabType, projectName?: string | null): string {
  return [PAGE_TITLES[tab], projectName, 'EV-COST'].filter(Boolean).join(' · ')
}
