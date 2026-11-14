import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Sidebar } from '../../components/layout/Sidebar'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { cn } from '../../lib/utils'
import { DESKTOP_QUERY, useMediaQuery } from './useMediaQuery'
import { useNavStore } from './useNavStore'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The id the app bar's menu button points at with aria-controls. */
export const NAV_DRAWER_ID = 'app-navigation'

/** Closes the drawer whenever the user navigates or something opens on top of it. */
function useCloseOnNavigation(): void {
  useEffect(() => {
    const close = (): void => {
      if (useNavStore.getState().open) useNavStore.getState().setOpen(false)
    }
    const offApp = useAppStore.subscribe((s, p) => {
      if (
        s.activeTab !== p.activeTab ||
        (s.isAddModalOpen && !p.isAddModalOpen) ||
        (s.isImportModalOpen && !p.isImportModalOpen) ||
        (s.isSettingsModalOpen && !p.isSettingsModalOpen) ||
        (s.confirm && !p.confirm) ||
        (s.inspectedItem && !p.inspectedItem) ||
        (s.isCommandOpen && !p.isCommandOpen)
      ) {
        close()
      }
    })
    const offCost = useCostStore.subscribe((s, p) => {
      if (s.activeProjectId !== p.activeProjectId) close()
    })
    return () => {
      offApp()
      offCost()
    }
  }, [])
}

/**
 * The shared sidebar, laid out for the screen: persistent from 1024px up, as
 * on the desktop app, and an off-canvas drawer with a scrim below that. The
 * drawer traps focus, closes on Esc, on the scrim and on navigation, and gives
 * focus back to whatever opened it.
 */
export const ResponsiveSidebar: React.FC = () => {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const open = useNavStore((s) => s.open)
  const setOpen = useNavStore((s) => s.setOpen)
  const panelRef = useRef<HTMLDivElement>(null)

  useCloseOnNavigation()

  useEffect(() => {
    if (isDesktop) setOpen(false)
  }, [isDesktop, setOpen])

  useEffect(() => {
    if (!open || isDesktop) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const current = panel?.querySelector<HTMLElement>('[aria-current="page"]')
    ;(current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus()
    return () => {
      // Hand focus back only if it is still inside the closed drawer (not in a modal it opened).
      if (
        !panel ||
        panel.contains(document.activeElement) ||
        document.activeElement === document.body
      )
        previous?.focus?.()
    }
  }, [open, isDesktop])

  if (isDesktop) return <Sidebar />

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[var(--scrim)] animate-fade-in"
          onClick={() => setOpen(false)}
          aria-hidden
          data-testid="nav-scrim"
        />
      )}
      <div
        ref={panelRef}
        id={NAV_DRAWER_ID}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Navigation"
        aria-hidden={!open || undefined}
        inert={!open}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex max-w-[86vw] outline-none duration-200 ease-out',
          // Visible at once when opening (so focus can land); hidden only after sliding out.
          open
            ? 'visible translate-x-0 shadow-drawer transition-transform'
            : 'invisible -translate-x-full transition-[transform,visibility]'
        )}
      >
        <Sidebar />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-2 top-3.5 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </>
  )
}
