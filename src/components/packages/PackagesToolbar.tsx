import React from 'react'
import { Search, X } from 'lucide-react'
import { useCostStore, HealthFilter } from '../../store/useCostStore'
import { useCategories, useEnrichedItems, useFilteredItems } from '../../hooks/useEvm'
import { HEALTH_META } from '../ui/status'
import { inputClass } from '../ui/field'
import { cn } from '../../lib/utils'
import type { HealthLevel } from '../../lib/calculations'

const HEALTH_ORDER: HealthLevel[] = ['critical', 'at-risk', 'watch', 'healthy']

export const PackagesToolbar: React.FC = () => {
  const searchQuery = useCostStore((s) => s.searchQuery)
  const setSearchQuery = useCostStore((s) => s.setSearchQuery)
  const categoryFilter = useCostStore((s) => s.categoryFilter)
  const setCategoryFilter = useCostStore((s) => s.setCategoryFilter)
  const healthFilter = useCostStore((s) => s.healthFilter)
  const setHealthFilter = useCostStore((s) => s.setHealthFilter)
  const clearFilters = useCostStore((s) => s.clearFilters)

  const categories = useCategories()
  const all = useEnrichedItems()
  const visible = useFilteredItems()
  const filtered = searchQuery !== '' || categoryFilter !== 'ALL' || healthFilter !== 'ALL'

  const healthCounts = HEALTH_ORDER.map((level) => ({
    level,
    count: all.filter((r) => r.health === level).length
  }))

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-[320px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <input
          id="package-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, category or notes"
          aria-label="Search work packages"
          className={cn(inputClass, 'pl-9 pr-10')}
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm border border-rule bg-plane px-1.5 text-caption text-ink-3">
          /
        </kbd>
      </div>

      <label className="flex min-w-0 items-center gap-2 text-small font-semibold text-ink-2">
        Category
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={cn(inputClass, 'w-auto min-w-0 pr-8 font-normal sm:min-w-[180px]')}
        >
          <option value="ALL">All categories ({all.length})</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </label>

      <div
        role="group"
        aria-label="Filter by health"
        className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-subtle-2 p-0.5"
      >
        {[{ level: 'ALL' as HealthFilter, count: all.length }, ...healthCounts].map(
          ({ level, count }) => {
            const active = healthFilter === level
            const meta = level === 'ALL' ? null : HEALTH_META[level]
            const Icon = meta?.icon
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                disabled={level !== 'ALL' && count === 0}
                onClick={() => setHealthFilter(level)}
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-small font-medium transition-colors disabled:opacity-40',
                  active ? 'bg-paper text-ink shadow-panel' : 'text-ink-2 hover:text-ink'
                )}
              >
                {Icon && <Icon className={cn('size-3.5', meta?.text)} aria-hidden />}
                {meta ? meta.label : 'All'}
                <span className={cn('num', 'text-ink-3')}>{count}</span>
              </button>
            )
          }
        )}
      </div>

      <div className="ml-auto flex items-center gap-3 text-small text-ink-3">
        <span className="num">
          Showing <strong className="text-ink">{visible.length}</strong> of {all.length}
        </span>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-ink-3 hover:bg-subtle"
          >
            <X className="size-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
