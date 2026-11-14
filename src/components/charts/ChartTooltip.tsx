import React from 'react'

export interface TooltipRow {
  label: string
  value: string
  color?: string
  emphasis?: boolean
}

/** Shared tooltip body. Text uses ink tokens; colour lives only in the swatch. */
export function TooltipCard({
  title,
  rows,
  footer
}: {
  title: string
  rows: TooltipRow[]
  footer?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="pointer-events-none max-w-[300px] rounded-md border border-rule bg-paper px-3 py-2.5 text-small shadow-lift">
      <div className="mb-1.5 font-semibold leading-snug text-ink">{title}</div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <dt className="flex items-center gap-1.5 text-ink-3">
              {row.color && (
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: row.color }}
                  aria-hidden
                />
              )}
              {row.label}
            </dt>
            <dd
              className={`num text-right ${row.emphasis ? 'font-semibold text-ink' : 'text-ink-2'}`}
            >
              {row.value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      {footer && (
        <div className="mt-2 border-t border-rule pt-1.5 text-caption text-ink-3">{footer}</div>
      )}
    </div>
  )
}
