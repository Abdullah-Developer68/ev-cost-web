import React from 'react'
import { Menu, Plus, Search, Sigma } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useActiveProject } from '../../hooks/useEvm'
import { Button } from '../../components/ui/button'
import { PAGE_TITLES } from '../routes'
import { NAV_DRAWER_ID } from './ResponsiveSidebar'
import { useNavStore } from './useNavStore'

/**
 * The top bar below 1024px, where the sidebar is a drawer: the menu button,
 * the brand mark, the page title and the page's primary action.
 */
export const AppBar: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab)
  const setIsAddModalOpen = useAppStore((s) => s.setIsAddModalOpen)
  const setIsCommandOpen = useAppStore((s) => s.setIsCommandOpen)
  const project = useActiveProject()
  const open = useNavStore((s) => s.open)
  const setOpen = useNavStore((s) => s.setOpen)

  return (
    <div
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-rule bg-plane px-2 sm:px-4 lg:hidden"
      data-testid="app-bar"
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={NAV_DRAWER_ID}
        className="flex size-10 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
      >
        <Menu className="size-5" />
      </button>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg"
        aria-hidden
      >
        <Sigma className="size-4" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-ui font-semibold text-ink">{PAGE_TITLES[activeTab]}</div>
        <div className="truncate text-caption text-ink-3">EV-COST</div>
      </div>
      <button
        type="button"
        onClick={() => setIsCommandOpen(true)}
        aria-label="Search or jump to"
        title="Search or jump to"
        className="flex size-10 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
      >
        <Search className="size-5" />
      </button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setIsAddModalOpen(true)}
        disabled={!project}
        aria-label="New work package"
        title="New work package (N)"
      >
        <Plus aria-hidden />
        <span className="max-[370px]:hidden">Work package</span>
      </Button>
    </div>
  )
}
