import React from 'react'
import { CheckCircle2, Info, OctagonAlert, X } from 'lucide-react'
import { useToastStore } from '../../store/useToastStore'
import { cn } from '../../lib/utils'

const TONE = {
  success: { icon: CheckCircle2, iconClass: 'text-good' },
  error: { icon: OctagonAlert, iconClass: 'text-bad' },
  info: { icon: Info, iconClass: 'text-ink-3' }
}

export const Toaster: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[380px] flex-col gap-2"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => {
        const tone = TONE[t.tone]
        const Icon = tone.icon
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 card px-4 py-3 shadow-lift animate-rise-in"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', tone.iconClass)} aria-hidden />
            <p className="min-w-0 flex-1 text-body text-ink">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.run()
                  dismiss(t.id)
                }}
                className="shrink-0 rounded px-1.5 text-body font-semibold text-ink underline-offset-2 hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 shrink-0 rounded p-0.5 text-ink-3 hover:bg-subtle hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
