import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, SearchX, Trash2 } from 'lucide-react'
import { useCostStore } from '../../store/useCostStore'
import { useAppStore } from '../../store/useAppStore'
import { EnrichedItem, useFilteredItems, useProjectSummary } from '../../hooks/useEvm'
import { HealthBadge, toneOfIndex, toneOfMoney, TONE_TEXT } from '../ui/status'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/panel'
import {
  cn,
  formatCurrency,
  formatIndex,
  formatSignedCurrency,
  formatSignedPercent
} from '../../lib/utils'
import type { HealthLevel } from '../../lib/calculations'

type SortKey =
  | 'name'
  | 'health'
  | 'bac'
  | 'progress'
  | 'ac'
  | 'cv'
  | 'sv'
  | 'cpi'
  | 'spi'
  | 'eac'
  | 'vac'
  | 'tcpi'

const HEALTH_RANK: Record<HealthLevel, number> = { critical: 0, 'at-risk': 1, watch: 2, healthy: 3 }

/** The percentage variance under a money variance, e.g. −25.0%. */
const PercentLine: React.FC<{ value: number | null }> = ({ value }) =>
  value === null ? null : (
    <div className="text-caption font-normal opacity-80">{formatSignedPercent(value)}</div>
  )

const COLUMNS: Array<{ key: SortKey; label: string; title: string; align: 'left' | 'right' }> = [
  { key: 'name', label: 'Work package', title: 'Name and category', align: 'left' },
  { key: 'health', label: 'Health', title: 'From the weaker of CPI and SPI', align: 'left' },
  { key: 'bac', label: 'BAC', title: 'Budget at completion', align: 'right' },
  {
    key: 'progress',
    label: 'Progress',
    title: 'Actual % complete against planned %',
    align: 'left'
  },
  { key: 'ac', label: 'AC', title: 'Actual cost to date', align: 'right' },
  {
    key: 'cv',
    label: 'CV',
    title: 'Cost variance = EV − AC (below: CV% = CV ÷ EV)',
    align: 'right'
  },
  {
    key: 'sv',
    label: 'SV',
    title: 'Schedule variance = EV − PV (below: SV% = SV ÷ PV)',
    align: 'right'
  },
  { key: 'cpi', label: 'CPI', title: 'Cost performance index = EV ÷ AC', align: 'right' },
  { key: 'spi', label: 'SPI', title: 'Schedule performance index = EV ÷ PV', align: 'right' },
  { key: 'eac', label: 'EAC', title: 'Estimate at completion = BAC ÷ CPI', align: 'right' },
  {
    key: 'vac',
    label: 'VAC',
    title: 'Variance at completion = BAC − EAC (below: VAC% = VAC ÷ BAC)',
    align: 'right'
  },
  {
    key: 'tcpi',
    label: 'TCPI',
    title: 'To-complete performance index = (BAC − EV) ÷ (BAC − AC)',
    align: 'right'
  }
]

function sortValue(row: EnrichedItem, key: SortKey): number | string {
  const m = row.metrics
  switch (key) {
    case 'name':
      return row.item.taskName.toLowerCase()
    case 'health':
      return HEALTH_RANK[row.health] * 10 + Math.min(m.cpi, m.spi)
    case 'progress':
      return m.actualPercent - m.plannedPercent
    case 'tcpi':
      return Number.isFinite(m.tcpi) ? m.tcpi : Number.MAX_VALUE
    default:
      return m[key]
  }
}

/** Actual % as a bar, with the planned % as a tick on the same track. */
const ProgressCell: React.FC<{ planned: number; actual: number }> = ({ planned, actual }) => {
  const behind = actual < planned - 0.01
  return (
    <div
      className="w-[118px]"
      title={`Actual ${actual.toFixed(1)}% · planned ${planned.toFixed(1)}%`}
    >
      <div className="num flex items-baseline justify-between text-small">
        <span className="font-semibold text-ink">{actual.toFixed(0)}%</span>
        <span className="text-caption text-ink-3">of {planned.toFixed(0)}% planned</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-subtle-2" aria-hidden>
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            behind ? 'bg-[var(--series-unfav)]' : 'bg-[var(--series-ev)]'
          )}
          style={{ width: `${actual}%` }}
        />
        <span
          className="absolute -inset-y-0.5 w-0.5 rounded-full bg-ink"
          style={{ left: `calc(${planned}% - 1px)` }}
        />
      </div>
    </div>
  )
}

const Row: React.FC<{ row: EnrichedItem }> = ({ row }) => {
  const currency = useAppStore((s) => s.currency)
  const setInspectedItem = useAppStore((s) => s.setInspectedItem)
  const setEditingItem = useAppStore((s) => s.setEditingItem)
  const requestConfirm = useAppStore((s) => s.requestConfirm)
  const deleteItem = useCostStore((s) => s.deleteItem)
  const { item, metrics: m, health } = row

  const td = 'border-b border-rule px-2 py-2.5 align-middle'
  const num = cn(td, 'num whitespace-nowrap text-right text-small')

  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-subtle focus-within:bg-subtle"
      onClick={() => setInspectedItem(item)}
    >
      <th
        scope="row"
        className={cn(
          td,
          'max-w-[160px] bg-paper pl-4 text-left font-normal transition-colors group-hover:bg-subtle group-focus-within:bg-subtle sm:max-w-[250px]',
          'sticky left-0 z-[1] shadow-[1px_0_0_var(--rule)] min-[1400px]:shadow-none'
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setInspectedItem(item)
          }}
          className="block max-w-full truncate text-left text-body font-semibold text-ink hover:text-ink-3 hover:underline"
          title={item.taskName}
        >
          {item.taskName}
        </button>
        <div className="mt-0.5 truncate text-caption text-ink-3" title={item.notes ?? undefined}>
          {item.category}
          {item.notes ? ` · ${item.notes}` : ''}
        </div>
      </th>
      <td className={td}>
        <HealthBadge level={health} />
      </td>
      <td className={num}>{formatCurrency(m.bac, currency)}</td>
      <td className={td}>
        <ProgressCell planned={m.plannedPercent} actual={m.actualPercent} />
      </td>
      <td className={num}>{formatCurrency(m.ac, currency)}</td>
      <td className={cn(num, 'font-mono font-medium', TONE_TEXT[toneOfMoney(m.cv)])}>
        {formatSignedCurrency(m.cv, currency)}
        <PercentLine value={m.cvPercent} />
      </td>
      <td className={cn(num, 'font-mono font-medium', TONE_TEXT[toneOfMoney(m.sv)])}>
        {formatSignedCurrency(m.sv, currency)}
        <PercentLine value={m.svPercent} />
      </td>
      <td className={cn(num, 'font-semibold', TONE_TEXT[toneOfIndex(m.cpi)])}>
        {formatIndex(m.cpi)}
      </td>
      <td className={cn(num, 'font-semibold', TONE_TEXT[toneOfIndex(m.spi)])}>
        {formatIndex(m.spi)}
      </td>
      <td className={num}>{formatCurrency(m.eac, currency)}</td>
      <td className={cn(num, 'font-mono font-medium', TONE_TEXT[toneOfMoney(m.vac)])}>
        {formatSignedCurrency(m.vac, currency)}
        <PercentLine value={m.vacPercent} />
      </td>
      <td className={cn(num, m.tcpi > 1.0000001 ? 'font-semibold text-risk' : 'text-ink-2')}>
        {formatIndex(m.tcpi)}
      </td>
      <td className={cn(td, 'whitespace-nowrap text-right')}>
        <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${item.taskName}`}
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              setEditingItem(item)
            }}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="danger-ghost"
            size="icon"
            aria-label={`Delete ${item.taskName}`}
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              requestConfirm({
                title: 'Delete this work package?',
                body: `“${item.taskName}” and its figures will be removed from the project. You can undo this right after.`,
                confirmLabel: 'Delete',
                tone: 'danger',
                onConfirm: () => deleteItem(item.id)
              })
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </td>
    </tr>
  )
}

export const PackagesTable: React.FC = () => {
  const rows = useFilteredItems()
  const summary = useProjectSummary()
  const currency = useAppStore((s) => s.currency)
  const clearFilters = useCostStore((s) => s.clearFilters)
  const totalItems = useCostStore((s) => s.items.length)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'health',
    dir: 'asc'
  })

  const sorted = useMemo(() => {
    const mult = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key)
      const vb = sortValue(b, sort.key)
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * mult
      return ((va as number) - (vb as number)) * mult
    })
  }, [rows, sort])

  const toggleSort = (key: SortKey): void =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    )

  if (rows.length === 0 && totalItems > 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<SearchX className="size-6" />}
          title="No work packages match"
          body="Try a different search, or clear the category and health filters."
          actions={<Button onClick={clearFilters}>Clear filters</Button>}
        />
      </div>
    )
  }

  const filteredView = rows.length !== totalItems
  const foot =
    'num whitespace-nowrap border-t border-rule-strong px-2 py-3 text-right text-small font-semibold'

  return (
    <div className="overflow-hidden card">
      <div className="max-h-[calc(100dvh-280px)] overflow-auto overscroll-x-contain">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-body">
          <caption className="sr-only">
            Work packages with their earned value metrics. Select a row to see the worked solution.
          </caption>
          <thead className="sticky top-0 z-10 bg-paper">
            <tr>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key
                const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn(
                      'whitespace-nowrap border-b border-rule bg-paper px-2 py-2.5 text-small font-semibold text-ink-3 first:pl-4',
                      col.key === 'name' &&
                        'sticky left-0 z-[1] shadow-[1px_0_0_var(--rule)] min-[1400px]:shadow-none',
                      col.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      title={`${col.title}. Click to sort.`}
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-sm underline-offset-4 hover:text-ink hover:underline',
                        col.align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      {col.label}
                      {active && <Icon className="size-3.5 text-ink-3" aria-hidden />}
                    </button>
                  </th>
                )
              })}
              <th scope="col" className="border-b border-rule px-2 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <Row key={row.item.id} row={row} />
            ))}
          </tbody>
          {!filteredView && (
            <tfoot className="sticky bottom-0 bg-subtle">
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-[1] shadow-[1px_0_0_var(--rule)] min-[1400px]:shadow-none whitespace-nowrap border-t border-rule-strong bg-subtle py-3 pl-4 pr-2 text-left text-body font-semibold text-ink"
                >
                  Project total
                </th>
                <td className="border-t border-rule-strong px-2 py-3" />
                <td className={foot}>{formatCurrency(summary.bac, currency)}</td>
                <td className="num border-t border-rule-strong px-2 py-3 text-small text-ink-2">
                  {summary.actualPercent.toFixed(1)}% of {summary.plannedPercent.toFixed(1)}%
                </td>
                <td className={foot}>{formatCurrency(summary.ac, currency)}</td>
                <td className={cn(foot, 'font-mono', TONE_TEXT[toneOfMoney(summary.cv)])}>
                  {formatSignedCurrency(summary.cv, currency)}
                </td>
                <td className={cn(foot, 'font-mono', TONE_TEXT[toneOfMoney(summary.sv)])}>
                  {formatSignedCurrency(summary.sv, currency)}
                </td>
                <td className={cn(foot, TONE_TEXT[toneOfIndex(summary.cpi)])}>
                  {formatIndex(summary.cpi)}
                </td>
                <td className={cn(foot, TONE_TEXT[toneOfIndex(summary.spi)])}>
                  {formatIndex(summary.spi)}
                </td>
                <td className={foot}>{formatCurrency(summary.eac, currency)}</td>
                <td className={cn(foot, 'font-mono', TONE_TEXT[toneOfMoney(summary.vac)])}>
                  {formatSignedCurrency(summary.vac, currency)}
                </td>
                <td className={foot}>{formatIndex(summary.tcpi)}</td>
                <td className="border-t border-rule-strong px-2 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
