import { describe, it, expect } from 'vitest'
import { countBySeverity, generateSuggestions, SuggestionInputItem } from './suggestions'

const pkg = (
  id: number,
  bac: number,
  plannedPercent: number,
  actualPercent: number,
  actualCost: number,
  taskName = `Package ${id}`
): SuggestionInputItem => ({ id, taskName, bac, plannedPercent, actualPercent, actualCost })

/** The seeded demo project shipped with the app. */
const demo: SuggestionInputItem[] = [
  pkg(1, 10000, 50, 40, 5000, 'Live Runtime Error Listener & Code Auto-Patching System'),
  pkg(2, 15000, 75, 80, 11000, 'AST Static Analysis & Syntax Tree Parser'),
  pkg(3, 12000, 60, 50, 6500, 'Sandboxed Execution & Regression Test Runner'),
  pkg(4, 8000, 90, 90, 7200, 'High-Throughput Telemetry Ingestion Pipeline'),
  pkg(5, 6000, 40, 30, 3500, 'Enterprise SSO & Role-Based Access Control')
]

describe('generateSuggestions', () => {
  it('asks for data when the project is empty', () => {
    const s = generateSuggestions([])
    expect(s).toHaveLength(1)
    expect(s[0].id).toBe('project-empty')
  })

  it('treats the benchmark package (CPI 0.80, SPI 0.80) as behind and over budget', () => {
    const [first] = generateSuggestions([pkg(1, 10000, 50, 40, 5000)]).filter(
      (s) => s.scope === 'package'
    )
    expect(first.id).toBe('pkg-1-behind-over')
    expect(first.severity).toBe('warning') // 0.80 is not below the 0.80 critical line
    expect(first.triggers.map((t) => t.metric)).toEqual(expect.arrayContaining(['CPI', 'SPI']))
    expect(first.detail).toContain('$12,500')
  })

  it('escalates to critical and recommends re-scoping when TCPI is out of reach', () => {
    const s = generateSuggestions([pkg(5, 6000, 40, 30, 3500)]).find((x) => x.itemId === 5)!
    expect(s.severity).toBe('critical') // CPI 0.51
    expect(s.title).toMatch(/^Re-scope/)
    expect(s.triggers.some((t) => t.metric === 'TCPI')).toBe(true)
  })

  it('separates cost-only and schedule-only problems', () => {
    const costOnly = generateSuggestions([pkg(1, 1000, 50, 50, 600)]).find((x) => x.itemId === 1)!
    expect(costOnly.category).toBe('cost')
    expect(costOnly.id).toBe('pkg-1-over-budget')

    const scheduleOnly = generateSuggestions([pkg(2, 1000, 60, 40, 380)]).find(
      (x) => x.itemId === 2
    )!
    expect(scheduleOnly.category).toBe('schedule')
    expect(scheduleOnly.id).toBe('pkg-2-behind')
  })

  it('flags an exhausted budget as critical with TCPI ∞', () => {
    const s = generateSuggestions([pkg(1, 1000, 80, 60, 1000)]).find((x) => x.itemId === 1)!
    expect(s.id).toBe('pkg-1-budget-exhausted')
    expect(s.severity).toBe('critical')
    expect(s.triggers[0].value).toBe('∞')
  })

  it('catches spend recorded with no progress before judging efficiency', () => {
    const s = generateSuggestions([pkg(1, 1000, 30, 0, 200)]).filter((x) => x.itemId === 1)
    expect(s).toHaveLength(1)
    expect(s[0].category).toBe('data')
  })

  it('handles finished packages with a retrospective or a release of surplus', () => {
    const over = generateSuggestions([pkg(1, 1000, 100, 100, 1200)]).find((x) => x.itemId === 1)!
    expect(over.id).toBe('pkg-1-closed-over')
    const under = generateSuggestions([pkg(2, 1000, 100, 100, 800)]).find((x) => x.itemId === 2)!
    expect(under.id).toBe('pkg-2-closed-under')
    expect(under.severity).toBe('positive')
  })

  it('says "hold course" when the whole project is healthy', () => {
    const s = generateSuggestions([pkg(1, 1000, 50, 50, 500), pkg(2, 1000, 40, 40, 400)])
    expect(s.map((x) => x.id)).toEqual(['project-healthy'])
  })

  it('ranks the seeded demo project: critical first, then by money at stake', () => {
    const s = generateSuggestions(demo)
    const ranks = { critical: 0, warning: 1, info: 2, positive: 3 }
    for (let i = 1; i < s.length; i++) {
      expect(ranks[s[i - 1].severity]).toBeLessThanOrEqual(ranks[s[i].severity])
    }
    expect(s[0].itemId).toBe(5) // SSO is the only critical package
    const ids = s.map((x) => x.id)
    expect(ids).toContain('project-forecast-overrun') // project CPI 0.93
    expect(ids).toContain('project-rebalance-2-3') // AST Parser is ahead, Sandboxed Runner behind
    expect(new Set(ids).size).toBe(ids.length) // ids are unique
  })

  it('uses the project currency in its text', () => {
    const s = generateSuggestions([pkg(1, 10000, 50, 40, 5000)], '€')
    expect(s.some((x) => x.detail.includes('€12,500'))).toBe(true)
  })

  it('counts suggestions by severity', () => {
    const counts = countBySeverity(generateSuggestions(demo))
    expect(counts.critical).toBe(1)
    expect(counts.critical + counts.warning + counts.info + counts.positive).toBe(
      generateSuggestions(demo).length
    )
  })
})
