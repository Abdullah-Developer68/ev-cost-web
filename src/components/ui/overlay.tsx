import React, { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Moves focus into the panel on open, keeps Tab inside it, and restores focus on close. */
function useFocusTrap(
  ref: React.RefObject<HTMLDivElement | null>
): (e: React.KeyboardEvent) => void {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = ref.current
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]')
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(preferred ?? first ?? panel)?.focus()
    return () => previous?.focus?.()
  }, [ref])

  return (e: React.KeyboardEvent): void => {
    if (e.key !== 'Tab' || !ref.current) return
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
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
}

interface ModalProps {
  title: string
  description?: React.ReactNode
  icon?: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

/** Centered dialog for tasks that need protected focus (forms, confirmations). */
export function Modal({
  title,
  description,
  icon,
  onClose,
  footer,
  width = 'md',
  children
}: ModalProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const trap = useFocusTrap(panelRef)

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center bg-[var(--scrim)] animate-fade-in sm:items-center sm:p-6',
        // Below 640px: small dialogs rise from the bottom, larger ones fill the screen.
        width === 'sm' ? 'items-end' : 'items-stretch'
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={trap}
        className={cn(
          'flex w-full flex-col overflow-hidden border-rule bg-paper shadow-lift outline-none animate-rise-in sm:max-h-[calc(100dvh-48px)] sm:rounded-xl sm:border',
          width === 'sm' ? 'max-h-[92dvh] rounded-t-xl border-t' : 'h-dvh sm:h-auto',
          width === 'sm' && 'max-w-md',
          width === 'md' && 'max-w-2xl',
          width === 'lg' && 'max-w-4xl'
        )}
      >
        <header className="flex items-start gap-3 border-b border-rule px-4 pb-4 pt-5 sm:px-6">
          {icon && <div className="mt-0.5 text-ink-3">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-h2 font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-body text-ink-3">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded p-1.5 text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </header>
        {/* Flex column so a form's own footer can sit at the bottom of a full-height sheet */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto [&>form]:flex [&>form]:flex-1 [&>form]:flex-col">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-plane px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

interface DrawerProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}

/** Right-hand panel for inspecting one record without leaving the page. */
export function Drawer({
  title,
  subtitle,
  onClose,
  actions,
  children
}: DrawerProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const trap = useFocusTrap(panelRef)

  return (
    <div
      className="fixed inset-0 z-40 bg-[var(--scrim)] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trap}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-rule bg-paper shadow-drawer outline-none animate-slide-in-right sm:w-[min(640px,92vw)] sm:border-l"
      >
        <header className="flex items-start gap-3 border-b border-rule px-4 pb-4 pt-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-h2 font-semibold leading-tight text-ink">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-body text-ink-3">{subtitle}</div>}
          </div>
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-2 rounded p-1.5 text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
