import { useMemo } from 'react'
import { useCostStore } from '../store/useCostStore'
import { useAppStore } from '../store/useAppStore'
import {
  calculateEvmMetrics,
  calculateProjectEvmSummary,
  EvmMetrics,
  healthOf,
  HealthLevel,
  ProjectEvmSummary
} from '../lib/calculations'
import { generateSuggestions, Suggestion } from '../lib/suggestions'
import { AnomalyReport, detectSpendAnomalies } from '../lib/anomalies'
import { Project, WorkPackageItem } from '../types'

export interface EnrichedItem {
  item: WorkPackageItem
  metrics: EvmMetrics
  health: HealthLevel
}

export function useActiveProject(): Project | undefined {
  const projects = useCostStore((s) => s.projects)
  const activeProjectId = useCostStore((s) => s.activeProjectId)
  return useMemo(() => projects.find((p) => p.id === activeProjectId), [projects, activeProjectId])
}

export function useProjectSummary(): ProjectEvmSummary {
  const items = useCostStore((s) => s.items)
  return useMemo(() => calculateProjectEvmSummary(items), [items])
}

export function useEnrichedItems(): EnrichedItem[] {
  const items = useCostStore((s) => s.items)
  return useMemo(
    () =>
      items.map((item) => {
        const metrics = calculateEvmMetrics(item)
        return { item, metrics, health: healthOf(metrics.cpi, metrics.spi).level }
      }),
    [items]
  )
}

export function useSuggestions(): Suggestion[] {
  const items = useCostStore((s) => s.items)
  const currency = useAppStore((s) => s.currency)
  return useMemo(() => generateSuggestions(items, currency), [items, currency])
}

/** Unusual-spend findings for the active project. */
export function useAnomalies(): AnomalyReport {
  const items = useCostStore((s) => s.items)
  const currency = useAppStore((s) => s.currency)
  return useMemo(() => detectSpendAnomalies(items, currency), [items, currency])
}

/** Items after the search, category and health filters, still enriched. */
export function useFilteredItems(): EnrichedItem[] {
  const rows = useEnrichedItems()
  const searchQuery = useCostStore((s) => s.searchQuery)
  const categoryFilter = useCostStore((s) => s.categoryFilter)
  const healthFilter = useCostStore((s) => s.healthFilter)
  return useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows.filter(({ item, health }) => {
      const matchesSearch =
        !q ||
        item.taskName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.notes ?? '').toLowerCase().includes(q)
      const matchesCategory =
        categoryFilter === 'ALL' || (item.category || 'General') === categoryFilter
      const matchesHealth = healthFilter === 'ALL' || health === healthFilter
      return matchesSearch && matchesCategory && matchesHealth
    })
  }, [rows, searchQuery, categoryFilter, healthFilter])
}

/** Distinct categories with their package counts, in first-seen order. */
export function useCategories(): Array<{ name: string; count: number }> {
  const items = useCostStore((s) => s.items)
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      const name = item.category || 'General'
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    return Array.from(map, ([name, count]) => ({ name, count }))
  }, [items])
}
