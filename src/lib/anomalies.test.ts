import { describe, expect, it } from 'vitest'
import {
  ANOMALY_RULES,
  detectSpendAnomalies,
  median,
  modifiedZScores,
  summarizeAnomalies,
  type AnomalyInputItem
} from './anomalies'

let nextId = 1
const pkg = (
  bac: number,
  plannedPercent: number,
  actualPercent: number,
  actualCost: number,
  taskName = `Package ${nextId}`
): AnomalyInputItem => ({
  id: nextId++,
  taskName,
  category: 'Core',
  bac,
  plannedPercent,
  actualPercent,
  actualCost
})

/** The seeded demo project (synthetic data). */
const DEMO = [
  pkg(10000, 50, 40, 5000, 'Runtime listener'),
  pkg(15000, 75, 80, 11000, 'AST parser'),
  pkg(12000, 60, 50, 6500, 'Sandbox runner'),
  pkg(8000, 90, 90, 7200, 'Telemetry pipeline'),
  pkg(6000, 40, 30, 3500, 'Enterprise SSO')
]

describe('median and modified z-scores', () => {
  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNaN()
  })

  it('scores the textbook example: an obvious outlier clears 3.5', () => {
    const z = modifiedZScores([10, 11, 10, 12, 11, 10, 40])
    expect(z[6]).toBeGreaterThan(ANOMALY_RULES.extremeAbove)
    z.slice(0, 6).forEach((v) => expect(Math.abs(v)).toBeLessThan(ANOMALY_RULES.unusualAbove))
  })

  it('falls back to the mean absolute deviation when MAD is zero', () => {
    const z = modifiedZScores([1, 1, 1, 1, 5])
    expect(Number.isFinite(z[4])).toBe(true)
    expect(z[4]).toBeGreaterThan(0)
  })

  it('returns zeros when every value is the same', () => {
    expect(modifiedZScores([2, 2, 2, 2])).toEqual([0, 0, 0, 0])
  })
})

describe('detectSpendAnomalies', () => {
  it('flags only Enterprise SSO in the demo project, as unusual overspend', () => {
    const report = detectSpendAnomalies(DEMO, '$')
    expect(report.status).toBe('ok')
    expect(report.scored).toBe(5)
    expect(report.anomalies).toHaveLength(1)
    const [a] = report.anomalies
    expect(a.taskName).toBe('Enterprise SSO')
    expect(a.kind).toBe('overspend')
    expect(a.level).toBe('unusual')
    // AC/EV = 3500 / 1800; peer median is the sandbox runner's 6500 / 6000
    expect(a.costPerValue).toBeCloseTo(3500 / 1800, 6)
    expect(a.peerMedian).toBeCloseTo(6500 / 6000, 6)
    expect(a.score).toBeCloseTo(2.76, 2)
    expect(a.gap).toBeCloseTo(3500 - 1800 * (6500 / 6000), 6)
    expect(report.points.map((p) => p.level)).toEqual([null, null, null, null, 'unusual'])
  })

  it('finds nothing when every package spends at the same rate', () => {
    const report = detectSpendAnomalies([
      pkg(1000, 50, 50, 500),
      pkg(2000, 50, 50, 1000),
      pkg(4000, 50, 50, 2000),
      pkg(8000, 50, 50, 4000)
    ])
    expect(report.anomalies).toEqual([])
    expect(summarizeAnomalies(report)).toMatch(/No unusual spending found across 4 packages/)
  })

  it('marks a package spending four times its peers as extreme', () => {
    const report = detectSpendAnomalies([
      pkg(1000, 50, 50, 500),
      pkg(1000, 50, 50, 520),
      pkg(1000, 50, 50, 480),
      pkg(1000, 50, 50, 510),
      pkg(1000, 50, 50, 2000, 'Runaway')
    ])
    expect(report.anomalies[0].taskName).toBe('Runaway')
    expect(report.anomalies[0].level).toBe('extreme')
    expect(report.anomalies[0].kind).toBe('overspend')
  })

  it('flags suspiciously cheap work as underspend', () => {
    const report = detectSpendAnomalies([
      pkg(1000, 50, 50, 500),
      pkg(1000, 50, 50, 520),
      pkg(1000, 50, 50, 480),
      pkg(1000, 50, 50, 510),
      pkg(1000, 50, 50, 100, 'Too cheap')
    ])
    const cheap = report.anomalies.find((a) => a.taskName === 'Too cheap')
    expect(cheap?.kind).toBe('underspend')
    expect(cheap?.explanation).toMatch(/unrecorded costs/)
  })

  it('treats over- and under-spending by the same factor symmetrically', () => {
    const base = [pkg(1000, 50, 50, 500), pkg(1000, 50, 50, 500), pkg(1000, 50, 50, 500)]
    const high = detectSpendAnomalies([...base, pkg(1000, 50, 50, 505), pkg(1000, 50, 50, 2000)])
    const low = detectSpendAnomalies([...base, pkg(1000, 50, 50, 505), pkg(1000, 50, 50, 125)])
    expect(Math.abs(high.anomalies[0].score ?? 0)).toBeCloseTo(
      Math.abs(low.anomalies[0].score ?? 0),
      1
    )
  })

  it('reports spend with no progress without needing peers', () => {
    const report = detectSpendAnomalies([pkg(5000, 30, 0, 1200, 'Stalled')])
    expect(report.status).toBe('too-few')
    expect(report.anomalies).toHaveLength(1)
    expect(report.anomalies[0].kind).toBe('spend-without-progress')
    expect(report.anomalies[0].level).toBe('extreme') // work was planned, none earned
  })

  it('reports progress with no recorded cost', () => {
    const report = detectSpendAnomalies([pkg(5000, 30, 20, 0, 'Free work')])
    expect(report.anomalies[0].kind).toBe('progress-without-spend')
  })

  it('does not compare peers when fewer than the minimum can be scored', () => {
    const report = detectSpendAnomalies([
      pkg(1000, 50, 50, 500),
      pkg(1000, 50, 50, 500),
      pkg(1000, 50, 50, 5000)
    ])
    expect(report.status).toBe('too-few')
    expect(report.anomalies).toEqual([])
    expect(summarizeAnomalies(report)).toMatch(/too few to compare/)
  })

  it('ignores packages with neither progress nor spend', () => {
    const report = detectSpendAnomalies([...DEMO, pkg(9000, 0, 0, 0, 'Not started')])
    expect(report.scored).toBe(5)
    expect(report.anomalies.map((a) => a.taskName)).toEqual(['Enterprise SSO'])
  })

  it('is deterministic', () => {
    expect(detectSpendAnomalies(DEMO)).toEqual(detectSpendAnomalies(DEMO))
  })

  it('ranks extreme findings before unusual ones', () => {
    const report = detectSpendAnomalies([
      pkg(1000, 50, 50, 500),
      pkg(1000, 50, 50, 520),
      pkg(1000, 50, 50, 480),
      pkg(1000, 50, 50, 510),
      pkg(1000, 50, 50, 2000, 'Runaway'),
      pkg(100, 30, 0, 50, 'Small stalled')
    ])
    expect(report.anomalies[0].level).toBe('extreme')
    expect(summarizeAnomalies(report, '$')).toMatch(/^2 packages flagged \(2 extreme\)/)
  })
})
