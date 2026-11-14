import React from 'react'
import {
  FileText,
  FolderGit2,
  Monitor,
  Moon,
  Sigma,
  Sun,
  LayoutGrid,
  ListChecks,
  Plus,
  Search,
  Settings2,
  Table2
} from 'lucide-react'
import { useAppStore, TabType } from '../../store/useAppStore'
import type { ThemePreference } from '../../lib/theme'
import { useCostStore } from '../../store/useCostStore'
import { useSuggestions } from '../../hooks/useEvm'
import { countBySeverity } from '../../lib/suggestions'
import { cn } from '../../lib/utils'
import { modKeyLabel } from '../../lib/commands'
import { pageShortcut } from '../../platform/commands'
import { DataSourceStatus } from '../../platform/DataSourceStatus'

const NAV: Array<{ id: TabType; label: string; icon: typeof LayoutGrid; key: string }> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutGrid, key: '1' },
  { id: 'costs', label: 'Work packages', icon: Table2, key: '2' },
  { id: 'actions', label: 'Next actions', icon: ListChecks, key: '3' },
  { id: 'reports', label: 'Report', icon: FileText, key: '4' }
]

const MOD_KEY = modKeyLabel(typeof navigator === 'undefined' ? '' : navigator.platform)

const NavBadge: React.FC<{ tab: TabType }> = ({ tab }) => {
  const items = useCostStore((s) => s.items)
  const suggestions = useSuggestions()
  if (tab === 'costs') {
    return <span className="num ml-auto text-caption font-semibold text-ink-3">{items.length}</span>
  }
  if (tab === 'actions') {
    const counts = countBySeverity(suggestions)
    const urgent = counts.critical + counts.warning
    if (urgent === 0) return null
    return (
      <span
        className={cn(
          'num ml-auto rounded-full px-1.5 text-caption font-semibold',
          counts.critical > 0 ? 'bg-bad-bg text-bad' : 'bg-risk-bg text-risk'
        )}
        aria-label={`${urgent} urgent`}
      >
        {urgent}
      </span>
    )
  }
  return null
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

/** Light / dark / follow-the-OS switch, as a small segmented control. */
const ThemeSwitch: React.FC = () => {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 gap-0.5 rounded-full bg-subtle-2 p-0.5"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={cn(
              'flex h-7 items-center justify-center gap-1 rounded-full text-caption font-medium transition-colors duration-150',
              active ? 'bg-paper text-ink shadow-panel' : 'text-ink-3 hover:text-ink'
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export const Sidebar: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setIsSettingsModalOpen = useAppStore((s) => s.setIsSettingsModalOpen)
  const setIsAddModalOpen = useAppStore((s) => s.setIsAddModalOpen)
  const setIsCommandOpen = useAppStore((s) => s.setIsCommandOpen)

  const projects = useCostStore((s) => s.projects)
  const activeProjectId = useCostStore((s) => s.activeProjectId)
  const selectProject = useCostStore((s) => s.selectProject)
  const isBooting = useCostStore((s) => s.isBooting)

  const item = (active: boolean): string =>
    cn(
      'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-body transition-colors duration-150',
      active ? 'bg-subtle-2 font-medium text-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink'
    )

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-rule bg-sunken">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-fg">
          <Sigma className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-ui font-semibold leading-tight tracking-tight text-ink">EV-COST</div>
          <div className="text-caption text-ink-3">Earned value workbook</div>
        </div>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setIsCommandOpen(true)}
          className="flex h-8 w-full items-center gap-2.5 rounded-md border border-rule bg-paper px-2.5 text-body text-ink-3 shadow-panel transition-colors duration-150 hover:border-rule-strong hover:text-ink-2"
          title={`Search or run a command (${MOD_KEY}+K)`}
        >
          <Search className="size-4" aria-hidden />
          Search or jump to
          <kbd className="ml-auto font-mono text-caption text-ink-3 [@media(pointer:coarse)]:hidden">
            {MOD_KEY} K
          </kbd>
        </button>
      </div>

      <nav aria-label="Workspace" className="px-2">
        <ul className="flex flex-col gap-px">
          <li>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              disabled={!activeProjectId}
              className={cn(item(false), 'disabled:opacity-50')}
              title="New work package (N)"
            >
              <Plus className="size-4 text-ink-3" aria-hidden />
              New work package
              <kbd className="ml-auto rounded border border-rule bg-paper px-1.5 font-mono text-caption text-ink-3">
                N
              </kbd>
            </button>
          </li>
          {NAV.map((nav) => {
            const active = activeTab === nav.id
            const Icon = nav.icon
            return (
              <li key={nav.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  aria-current={active ? 'page' : undefined}
                  title={`${nav.label} (${pageShortcut(nav.key)})`}
                  className={item(active)}
                >
                  <Icon className={cn('size-4', active ? 'text-ink' : 'text-ink-3')} aria-hidden />
                  {nav.label}
                  <NavBadge tab={nav.id} />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col px-2">
        <div className="flex items-center justify-between px-2.5 pb-1">
          <span className="label-caps">Projects</span>
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true, 'create')}
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
            aria-label="New project"
            title="New project"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <ul className="flex min-h-0 flex-col gap-px overflow-y-auto">
          {isBooting &&
            [0, 1].map((i) => <li key={i} className="skeleton mx-2.5 my-1 h-5" aria-hidden />)}
          {projects.map((project) => {
            const active = project.id === activeProjectId
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => selectProject(project.id)}
                  aria-current={active ? 'true' : undefined}
                  title={project.name}
                  className={item(active)}
                >
                  <FolderGit2 className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="truncate">{project.name}</span>
                  {active && (
                    <span className="ml-auto size-1.5 shrink-0 rounded-full bg-spot" aria-hidden />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-rule p-3">
        <DataSourceStatus />
        <ThemeSwitch />
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true, 'edit')}
          disabled={!activeProjectId}
          className={cn(item(false), 'disabled:opacity-50')}
        >
          <Settings2 className="size-4 text-ink-3" aria-hidden />
          Project settings
        </button>
      </div>
    </aside>
  )
}
