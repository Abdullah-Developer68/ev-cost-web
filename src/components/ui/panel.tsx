import React, { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PanelProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/** White sheet on the blue-grey plane. */
export function Panel({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  children
}: PanelProps): React.JSX.Element {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-h3 font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-small text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('px-5 pb-5 pt-3', bodyClassName)}>{children}</div>
    </section>
  )
}

export interface LegendEntry {
  label: string
  color: string
  shape?: 'bar' | 'dot' | 'line' | 'track'
}

export function Legend({ entries }: { entries: LegendEntry[] }): React.JSX.Element {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-2"
      aria-label="Legend"
    >
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'inline-block shrink-0',
              entry.shape === 'dot' && 'size-2.5 rounded-full',
              entry.shape === 'line' && 'h-0.5 w-4 rounded-full',
              entry.shape === 'track' && 'h-2.5 w-4 rounded-sm',
              (!entry.shape || entry.shape === 'bar') && 'h-2.5 w-2.5 rounded-sm'
            )}
            style={{ background: entry.color }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  )
}

interface ChartPanelProps {
  title: string
  subtitle?: string
  legend?: LegendEntry[]
  /** The same data as a table: every chart has a non-visual reading. */
  table: React.ReactNode
  className?: string
  height?: number
  children: React.ReactNode
}

/** A chart with its title, legend and a "view as table" toggle. */
export function ChartPanel({
  title,
  subtitle,
  legend,
  table,
  className,
  height = 280,
  children
}: ChartPanelProps): React.JSX.Element {
  const [asTable, setAsTable] = useState(false)
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      className={className}
      actions={
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-caption font-semibold text-ink-3 transition-colors hover:bg-subtle hover:text-ink-3"
        >
          {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      }
    >
      {legend && !asTable && (
        <div className="mb-3">
          <Legend entries={legend} />
        </div>
      )}
      {asTable ? (
        <div className="max-h-[320px] overflow-auto">{table}</div>
      ) : (
        <div style={{ height }} className="w-full">
          {children}
        </div>
      )}
    </Panel>
  )
}

/** Compact data table used for chart table views and small breakdowns. */
export function MiniTable({
  head,
  rows,
  align
}: {
  head: string[]
  rows: React.ReactNode[][]
  align?: Array<'left' | 'right'>
}): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-small">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              className={cn(
                'border-b border-rule px-2 py-1.5 font-semibold text-ink-3',
                align?.[i] === 'right' ? 'text-right' : 'text-left'
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-rule last:border-0">
            {row.map((cell, c) => (
              <td
                key={c}
                className={cn(
                  'px-2 py-1.5 text-ink',
                  align?.[c] === 'right' ? 'text-right num' : 'text-left'
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  actions
}: {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-subtle text-ink-3">
        {icon}
      </div>
      <h3 className="font-display text-h2 font-semibold text-ink">{title}</h3>
      <div className="mt-1.5 max-w-md text-body text-ink-3">{body}</div>
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}
