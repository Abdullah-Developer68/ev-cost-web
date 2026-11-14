import React, { useEffect, useRef } from 'react'
import { RefreshCw, ServerCrash } from 'lucide-react'
import { WorkspaceHeader } from './components/layout/WorkspaceHeader'
import { DashboardPage } from './pages/DashboardPage'
import { CostSheetPage } from './pages/CostSheetPage'
import { ActionsPage } from './pages/ActionsPage'
import { ReportsPage } from './pages/ReportsPage'
import { PackageDrawer } from './components/packages/PackageDrawer'
import { WorkPackageModal } from './components/packages/WorkPackageModal'
import { ImportModal } from './components/packages/ImportModal'
import { ProjectSettingsModal } from './components/settings/ProjectSettingsModal'
import { ConfirmDialog } from './components/feedback/ConfirmDialog'
import { Toaster } from './components/feedback/Toaster'
import { Button } from './components/ui/button'
import { EmptyState } from './components/ui/panel'
import { useCostStore } from './store/useCostStore'
import { useAppStore, TabType } from './store/useAppStore'
import { applyTheme, resolveTheme } from './lib/theme'
import { pageShortcutIndex } from './platform/shortcuts'
import { ResponsiveSidebar } from './platform/layout/ResponsiveSidebar'
import { AppBar } from './platform/layout/AppBar'
import { CommandPalette } from './components/command/CommandPalette'

const TABS: TabType[] = ['dashboard', 'costs', 'actions', 'reports']

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const app = useAppStore.getState()
      if (e.key === 'Escape') {
        if (app.closeTopOverlay()) e.preventDefault()
        return
      }
      const dialogOpen =
        app.isAddModalOpen || app.isImportModalOpen || app.isSettingsModalOpen || app.confirm
      // Ctrl/Cmd+K opens the command menu from anywhere, even while typing in a field.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!dialogOpen) app.setIsCommandOpen(!app.isCommandOpen)
        return
      }
      const overlayOpen = dialogOpen || app.inspectedItem || app.isCommandOpen
      if (overlayOpen || isTyping(e.target) || e.ctrlKey || e.metaKey) return

      const page = pageShortcutIndex(e)
      if (page !== null) {
        e.preventDefault()
        app.setActiveTab(TABS[page])
        return
      }
      if (e.altKey) return
      const hasProject = useCostStore.getState().activeProjectId !== null
      if ((e.key === 'n' || e.key === 'N') && hasProject) {
        e.preventDefault()
        app.setIsAddModalOpen(true)
      } else if (e.key === '/') {
        e.preventDefault()
        app.setActiveTab('costs')
        requestAnimationFrame(() => document.getElementById('package-search')?.focus())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Keeps <html data-theme> in sync with the preference and, on "system", the OS. */
function useThemeSync(): void {
  const theme = useAppStore((s) => s.theme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (): void => applyTheme(resolveTheme(theme, media.matches))
    update()
    if (theme !== 'system') return
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])
}

const PAGES: Record<TabType, React.FC> = {
  dashboard: DashboardPage,
  costs: CostSheetPage,
  actions: ActionsPage,
  reports: ReportsPage
}

function App(): React.JSX.Element {
  const activeTab = useAppStore((s) => s.activeTab)
  const fetchInitialData = useCostStore((s) => s.fetchInitialData)
  const error = useCostStore((s) => s.error)
  const isLoading = useCostStore((s) => s.isLoading)
  const isBooting = useCostStore((s) => s.isBooting)
  const mainRef = useRef<HTMLElement>(null)
  const started = useRef(false)

  useKeyboardShortcuts()
  useThemeSync()

  useEffect(() => {
    // Guard against StrictMode's double effect so the database is only hit once.
    if (started.current) return
    started.current = true
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [activeTab])

  const Page = PAGES[activeTab]

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-plane text-ink">
      <ResponsiveSidebar />
      <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto" aria-busy={isLoading}>
        <AppBar />
        {isLoading && !isBooting && (
          <div
            className="sticky top-0 z-30 h-0.5 w-full overflow-hidden bg-subtle-2"
            role="progressbar"
            aria-label="Loading"
          >
            <div className="h-full w-1/3 animate-[shimmer_1.1s_infinite] bg-spot" />
          </div>
        )}
        {error && !isBooting && useCostStore.getState().projects.length === 0 ? (
          <div className="p-4 sm:p-8">
            <div className="card">
              <EmptyState
                icon={<ServerCrash className="size-6" />}
                title="EV-COST couldn't load your data"
                body={error}
                actions={
                  <Button variant="primary" onClick={fetchInitialData} loading={isLoading}>
                    <RefreshCw aria-hidden />
                    Try again
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <>
            <WorkspaceHeader />
            <div className="px-4 pb-16 sm:px-8">
              <Page />
            </div>
          </>
        )}
      </main>

      <PackageDrawer />
      <WorkPackageModal />
      <ImportModal />
      <ProjectSettingsModal />
      <ConfirmDialog />
      <CommandPalette />
      <Toaster />
    </div>
  )
}

export default App
