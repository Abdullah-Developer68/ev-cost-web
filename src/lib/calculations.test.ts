import { describe, it, expect } from 'vitest'
import {
  calculateEacScenarios,
  calculateEvmMetrics,
  calculateProjectEvmSummary,
  healthOf
} from './calculations'

describe('Earned Value Management (EVM) 12-Metric Calculation Engine', () => {
  it('correctly calculates all 12 EVM metrics for the benchmark case', () => {
    const input = {
      bac: 10000,
      plannedPercent: 50,
      actualPercent: 40,
      actualCost: 5000
    }

    const metrics = calculateEvmMetrics(input)

    // 1. Foundational
    expect(metrics.bac).toBe(10000)
    expect(metrics.plannedPercent).toBe(50)
    expect(metrics.actualPercent).toBe(40)
    expect(metrics.pv).toBe(5000)
    expect(metrics.ev).toBe(4000)
    expect(metrics.ac).toBe(5000)

    // 2. Variances
    expect(metrics.cv).toBe(-1000)
    expect(metrics.sv).toBe(-1000)
    expect(metrics.costStatus).toBe('overrun')
    expect(metrics.scheduleStatus).toBe('behind')

    // 3. Performance Indices
    expect(metrics.cpi).toBeCloseTo(0.8, 4)
    expect(metrics.spi).toBeCloseTo(0.8, 4)
    expect(metrics.cpiStatus).toBe('inefficient')
    expect(metrics.spiStatus).toBe('behind')

    // 4. Forecasting Projections
    expect(metrics.eac).toBeCloseTo(12500, 2)
    expect(metrics.etc).toBeCloseTo(7500, 2)
    expect(metrics.vac).toBeCloseTo(-2500, 2)
    expect(metrics.tcpi).toBeCloseTo(1.2, 4)
    expect(metrics.vacStatus).toBe('deficit')
    expect(metrics.tcpiStatus).toBe('harder')
  })

  it('handles under-budget ahead-of-schedule project scenario', () => {
    const input = {
      bac: 20000,
      plannedPercent: 40,
      actualPercent: 60,
      actualCost: 8000
    }

    const metrics = calculateEvmMetrics(input)

    expect(metrics.pv).toBe(8000)
    expect(metrics.ev).toBe(12000)
    expect(metrics.ac).toBe(8000)
    expect(metrics.cv).toBe(4000)
    expect(metrics.sv).toBe(4000)
    expect(metrics.costStatus).toBe('under')
    expect(metrics.scheduleStatus).toBe('ahead')
    expect(metrics.cpi).toBe(1.5)
    expect(metrics.spi).toBe(1.5)
    expect(metrics.eac).toBeCloseTo(13333.33, 2)
    expect(metrics.vac).toBeGreaterThan(0)
    expect(metrics.vacStatus).toBe('surplus')
    expect(metrics.tcpi).toBeLessThan(1.0)
    expect(metrics.tcpiStatus).toBe('easier')
  })

  it('correctly aggregates multiple work packages in calculateProjectEvmSummary', () => {
    const items = [
      {
        bac: 10000,
        plannedPercent: 50,
        actualPercent: 40,
        actualCost: 5000,
        category: 'Engineering'
      },
      {
        bac: 10000,
        plannedPercent: 50,
        actualPercent: 60,
        actualCost: 4000,
        category: 'QA'
      }
    ]

    const summary = calculateProjectEvmSummary(items)

    expect(summary.totalModules).toBe(2)
    expect(summary.bac).toBe(20000)
    expect(summary.pv).toBe(10000)
    expect(summary.ev).toBe(10000)
    expect(summary.ac).toBe(9000)
    expect(summary.cv).toBe(1000)
    expect(summary.sv).toBe(0)
    expect(summary.cpi).toBeCloseTo(10000 / 9000, 4)
    expect(summary.spi).toBe(1.0)
    expect(summary.categories).toHaveLength(2)
  })
})

describe('EVM edge cases and conventions', () => {
  it('treats CPI as 1.00 when no cost is recorded yet', () => {
    const m = calculateEvmMetrics({
      bac: 1000,
      plannedPercent: 20,
      actualPercent: 10,
      actualCost: 0
    })
    expect(m.cpi).toBe(1)
    expect(m.eac).toBe(1000)
    expect(m.cpiStatus).toBe('on-target')
  })

  it('uses the atypical EAC when spend has earned nothing (CPI = 0)', () => {
    const m = calculateEvmMetrics({
      bac: 1000,
      plannedPercent: 20,
      actualPercent: 0,
      actualCost: 300
    })
    expect(m.cpi).toBe(0)
    expect(m.eac).toBe(1300) // AC + (BAC - EV)
    expect(Number.isFinite(m.eac)).toBe(true)
  })

  it('flags an exhausted budget with TCPI = Infinity instead of a fake number', () => {
    const m = calculateEvmMetrics({
      bac: 1000,
      plannedPercent: 80,
      actualPercent: 60,
      actualCost: 1200
    })
    expect(m.budgetExhausted).toBe(true)
    expect(m.tcpi).toBe(Infinity)
    expect(m.tcpiStatus).toBe('harder')
  })

  it('returns TCPI = 0 once all work is complete', () => {
    const m = calculateEvmMetrics({
      bac: 1000,
      plannedPercent: 100,
      actualPercent: 100,
      actualCost: 1100
    })
    expect(m.tcpi).toBe(0)
    expect(m.budgetExhausted).toBe(false)
    expect(m.etc).toBe(0)
  })

  it('ignores floating-point noise when deciding on-budget / on-target', () => {
    // 33.3% of 3000 = 999 earned against 999 spent
    const m = calculateEvmMetrics({
      bac: 3000,
      plannedPercent: 33.3,
      actualPercent: 33.3,
      actualCost: 999
    })
    expect(m.costStatus).toBe('on-budget')
    expect(m.scheduleStatus).toBe('on-schedule')
    expect(m.cpiStatus).toBe('on-target')
  })

  it('clamps out-of-range and non-finite inputs', () => {
    const m = calculateEvmMetrics({
      bac: -50,
      plannedPercent: 140,
      actualPercent: -5,
      actualCost: NaN
    })
    expect(m.bac).toBe(0)
    expect(m.plannedPercent).toBe(100)
    expect(m.actualPercent).toBe(0)
    expect(m.ac).toBe(0)
  })

  it('returns a neutral summary for an empty project', () => {
    const s = calculateProjectEvmSummary([])
    expect(s.totalModules).toBe(0)
    expect(s.bac).toBe(0)
    expect(s.cpi).toBe(1)
    expect(s.spi).toBe(1)
    expect(s.categories).toEqual([])
  })

  it('derives project indices from summed values, not averaged indices', () => {
    const s = calculateProjectEvmSummary([
      { bac: 1000, plannedPercent: 100, actualPercent: 100, actualCost: 2000 }, // CPI 0.5
      { bac: 9000, plannedPercent: 100, actualPercent: 100, actualCost: 9000 } // CPI 1.0
    ])
    expect(s.cpi).toBeCloseTo(10000 / 11000, 6) // not (0.5 + 1) / 2
  })

  it('groups categories and defaults blank ones to General', () => {
    const s = calculateProjectEvmSummary([
      { bac: 100, plannedPercent: 50, actualPercent: 50, actualCost: 50, category: 'QA' },
      { bac: 100, plannedPercent: 50, actualPercent: 50, actualCost: 50, category: '  ' },
      { bac: 100, plannedPercent: 50, actualPercent: 50, actualCost: 50 }
    ])
    const general = s.categories.find((c) => c.category === 'General')
    expect(general?.itemCount).toBe(2)
    expect(s.categories).toHaveLength(2)
  })
})

describe('EAC scenarios', () => {
  it('brackets the benchmark forecast with the three standard methods', () => {
    const m = calculateEvmMetrics({
      bac: 10000,
      plannedPercent: 50,
      actualPercent: 40,
      actualCost: 5000
    })
    const byId = Object.fromEntries(calculateEacScenarios(m).map((s) => [s.id, s.eac]))
    expect(byId.atypical).toBeCloseTo(11000, 6) // 5000 + (10000 - 4000)
    expect(byId.typical).toBeCloseTo(12500, 6) // 10000 / 0.8
    expect(byId.composite).toBeCloseTo(14375, 6) // 5000 + 6000 / (0.8 * 0.8)
  })
})

describe('healthOf', () => {
  it('bands health by the weaker of CPI and SPI', () => {
    expect(healthOf(1.2, 1.0).level).toBe('healthy')
    expect(healthOf(1.2, 0.97).level).toBe('watch')
    expect(healthOf(0.9, 1.3).level).toBe('at-risk')
    expect(healthOf(0.8, 0.8).level).toBe('critical')
    expect(healthOf(0.8, 0.95).weakest).toBe(0.8)
  })
})

describe('percentage variances', () => {
  it('works the reference benchmark: CV% = −25%, SV% = −20%, VAC% = −25%', () => {
    // BAC 10,000, planned 50%, actual 40%, AC 5,000 → EV 4,000, PV 5,000, EAC 12,500
    const m = calculateEvmMetrics({
      bac: 10000,
      plannedPercent: 50,
      actualPercent: 40,
      actualCost: 5000
    })
    expect(m.cvPercent).toBeCloseTo(-25, 6) // CV −1,000 ÷ EV 4,000
    expect(m.svPercent).toBeCloseTo(-20, 6) // SV −1,000 ÷ PV 5,000
    expect(m.vacPercent).toBeCloseTo(-25, 6) // VAC −2,500 ÷ BAC 10,000
  })

  it('is positive when under budget and ahead of schedule', () => {
    const m = calculateEvmMetrics({
      bac: 15000,
      plannedPercent: 75,
      actualPercent: 80,
      actualCost: 11000
    })
    expect(m.cvPercent).toBeCloseTo(((12000 - 11000) / 12000) * 100, 6)
    expect(m.svPercent).toBeCloseTo(((12000 - 11250) / 11250) * 100, 6)
    expect(m.vacPercent).toBeGreaterThan(0)
  })

  it('is null, not infinite, when the base is zero', () => {
    const m = calculateEvmMetrics({
      bac: 10000,
      plannedPercent: 0,
      actualPercent: 0,
      actualCost: 500
    })
    expect(m.cvPercent).toBeNull() // EV is 0
    expect(m.svPercent).toBeNull() // PV is 0
    expect(m.vacPercent).not.toBeNull()
    const empty = calculateEvmMetrics({
      bac: 0,
      plannedPercent: 0,
      actualPercent: 0,
      actualCost: 0
    })
    expect(empty.vacPercent).toBeNull()
  })

  it('is computed from the aggregates for the project, not averaged per package', () => {
    const s = calculateProjectEvmSummary([
      { bac: 10000, plannedPercent: 50, actualPercent: 40, actualCost: 5000 },
      { bac: 15000, plannedPercent: 75, actualPercent: 80, actualCost: 11000 }
    ])
    expect(s.cvPercent).toBeCloseTo((s.cv / s.ev) * 100, 9)
    expect(s.svPercent).toBeCloseTo((s.sv / s.pv) * 100, 9)
    expect(s.vacPercent).toBeCloseTo((s.vac / s.bac) * 100, 9)
  })
})
