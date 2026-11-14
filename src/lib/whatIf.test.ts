import { describe, expect, it } from 'vitest'
import {
  budgetChangeToBreakEven,
  clampBudgetChange,
  clampFutureCpi,
  formatFutureCpi,
  simulateForecast,
  WHAT_IF_LIMITS
} from './whatIf'

// The course benchmark: BAC 10,000, 40% done, 5,000 spent.
const benchmark = { bac: 10000, ev: 4000, ac: 5000 }

describe('simulateForecast', () => {
  it('reproduces the standard EAC when the current efficiency continues', () => {
    // CPI = 0.80, so EAC = 5,000 + 6,000 / 0.80 = 12,500 (same as BAC / CPI).
    const result = simulateForecast(benchmark, { futureCpi: 0.8, budgetChange: 0 })
    expect(result.remainingWork).toBe(6000)
    expect(result.etc).toBeCloseTo(7500, 6)
    expect(result.eac).toBeCloseTo(12500, 6)
    expect(result.vac).toBeCloseTo(-2500, 6)
    expect(result.outcome).toBe('over')
  })

  it('gives the break-even efficiency, which equals TCPI against the budget', () => {
    // TCPI = (BAC − EV) / (BAC − AC) = 6,000 / 5,000 = 1.20
    const result = simulateForecast(benchmark, { futureCpi: 1, budgetChange: 0 })
    expect(result.breakEvenCpi).toBeCloseTo(1.2, 6)
    expect(result.eac).toBe(11000)
    expect(result.vac).toBe(-1000)
  })

  it('lands exactly on budget when the remaining work runs at the break-even efficiency', () => {
    const result = simulateForecast(benchmark, { futureCpi: 1.2, budgetChange: 0 })
    expect(result.eac).toBeCloseTo(10000, 6)
    expect(result.outcome).toBe('on')
  })

  it('finishes under budget when the remaining work is efficient enough', () => {
    const result = simulateForecast(benchmark, { futureCpi: 1.5, budgetChange: 0 })
    expect(result.eac).toBe(9000)
    expect(result.vac).toBe(1000)
    expect(result.outcome).toBe('under')
  })

  it('moves the budget, not the forecast, when budget is added', () => {
    const base = simulateForecast(benchmark, { futureCpi: 0.8, budgetChange: 0 })
    const funded = simulateForecast(benchmark, { futureCpi: 0.8, budgetChange: 2500 })
    expect(funded.eac).toBe(base.eac)
    expect(funded.budget).toBe(12500)
    expect(funded.vac).toBeCloseTo(0, 6)
    expect(funded.outcome).toBe('on')
    // More money left means less efficiency is needed: 6,000 / 7,500 = 0.80
    expect(funded.breakEvenCpi).toBeCloseTo(0.8, 6)
  })

  it('reports that no efficiency can recover a budget that is already spent', () => {
    const spent = simulateForecast(
      { bac: 10000, ev: 4000, ac: 10000 },
      {
        futureCpi: 1,
        budgetChange: 0
      }
    )
    expect(spent.breakEvenCpi).toBe(Infinity)
    expect(spent.outcome).toBe('over')
  })

  it('handles a finished project: nothing left to spend, nothing needed', () => {
    const done = simulateForecast(
      { bac: 10000, ev: 10000, ac: 9000 },
      {
        futureCpi: 0.8,
        budgetChange: 0
      }
    )
    expect(done.etc).toBe(0)
    expect(done.eac).toBe(9000)
    expect(done.breakEvenCpi).toBe(0)
    expect(done.outcome).toBe('under')
  })

  it('handles an empty project without dividing by zero', () => {
    const empty = simulateForecast({ bac: 0, ev: 0, ac: 0 }, { futureCpi: 1, budgetChange: 0 })
    expect(empty).toMatchObject({ eac: 0, vac: 0, etc: 0, breakEvenCpi: 0, outcome: 'on' })
  })

  it('never divides by a zero, negative or missing efficiency', () => {
    for (const futureCpi of [0, -1, NaN, Infinity]) {
      const result = simulateForecast(benchmark, { futureCpi, budgetChange: 0 })
      expect(Number.isFinite(result.eac)).toBe(true)
      expect(result.eac).toBeGreaterThan(0)
    }
    // Zero is pulled up to the lowest allowed efficiency.
    expect(simulateForecast(benchmark, { futureCpi: 0, budgetChange: 0 }).eac).toBe(
      5000 + 6000 / WHAT_IF_LIMITS.minCpi
    )
  })

  it('cannot take the budget below zero', () => {
    const result = simulateForecast(benchmark, { futureCpi: 1, budgetChange: -50000 })
    expect(result.budget).toBe(0)
    expect(result.breakEvenCpi).toBe(Infinity)
  })
})

describe('clampFutureCpi', () => {
  it('keeps the value inside the slider range without rounding it', () => {
    expect(clampFutureCpi(0.934)).toBe(0.934)
    expect(clampFutureCpi(0.1)).toBe(WHAT_IF_LIMITS.minCpi)
    expect(clampFutureCpi(9)).toBe(WHAT_IF_LIMITS.maxCpi)
    expect(clampFutureCpi(NaN)).toBe(1)
    expect(clampFutureCpi(Infinity)).toBe(1)
  })
})

describe('formatFutureCpi', () => {
  it('shows two decimals for slider steps and three for values between them', () => {
    expect(formatFutureCpi(1)).toBe('1.00')
    expect(formatFutureCpi(1.1)).toBe('1.10')
    expect(formatFutureCpi(0.57)).toBe('0.57')
    expect(formatFutureCpi(0.9337349)).toBe('0.934')
    expect(formatFutureCpi(NaN)).toBe('—')
  })
})

describe('the current trend', () => {
  it('matches the standard EAC = BAC ÷ CPI exactly when the real CPI is used unrounded', () => {
    // The demo project: BAC 51,000, EV 31,000, AC 33,200. CPI = 0.93373…
    const totals = { bac: 51000, ev: 31000, ac: 33200 }
    const cpi = totals.ev / totals.ac
    const result = simulateForecast(totals, { futureCpi: cpi, budgetChange: 0 })
    expect(result.eac).toBeCloseTo(totals.bac / cpi, 6)
    expect(Math.round(result.eac)).toBe(54619)
  })
})

describe('clampBudgetChange', () => {
  it('keeps the change inside the allowed share of the budget', () => {
    expect(clampBudgetChange(1234.4, 10000)).toBe(1234)
    expect(clampBudgetChange(99999, 10000)).toBe(5000)
    expect(clampBudgetChange(-99999, 10000)).toBe(-2000)
    expect(clampBudgetChange(500, 0)).toBe(0)
    expect(clampBudgetChange(NaN, 10000)).toBe(0)
  })
})

describe('budgetChangeToBreakEven', () => {
  it('is the overrun at the chosen efficiency, rounded up to whole currency', () => {
    expect(budgetChangeToBreakEven(benchmark, 0.8)).toBe(2500)
    expect(budgetChangeToBreakEven(benchmark, 1)).toBe(1000)
    // 5,000 + 6,000 / 0.93 = 11,451.61…, so 1,452 covers it.
    expect(budgetChangeToBreakEven(benchmark, 0.93)).toBe(1452)
  })

  it('is negative when the forecast is under budget', () => {
    expect(budgetChangeToBreakEven(benchmark, 1.5)).toBe(-1000)
  })
})
