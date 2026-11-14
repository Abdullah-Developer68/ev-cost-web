/**
 * "What if?" forecasting: the standard EAC formula with the two things a
 * project manager can actually change — how efficiently the remaining work is
 * done, and how much budget there is. Pure functions, no side effects.
 */

export const WHAT_IF_LIMITS = {
  minCpi: 0.5,
  maxCpi: 1.5,
  stepCpi: 0.01,
  /** Budget change as a share of BAC. */
  minBudgetShare: -0.2,
  maxBudgetShare: 0.5,
  stepBudgetShare: 0.01
} as const

export interface WhatIfTotals {
  bac: number
  ev: number
  ac: number
}

export interface WhatIfInput {
  /** Cost efficiency assumed for the work still to do (a CPI for the future). */
  futureCpi: number
  /** Money added to the budget (negative to remove some). */
  budgetChange: number
}

export type WhatIfOutcome = 'under' | 'on' | 'over'

export interface WhatIfResult {
  /** BAC plus the budget change. */
  budget: number
  /** Value still to earn: BAC − EV. */
  remainingWork: number
  /** Cost to finish at the assumed efficiency: remaining work ÷ future CPI. */
  etc: number
  /** Forecast final cost: AC + ETC. */
  eac: number
  /** Budget − EAC. Negative means over budget. */
  vac: number
  /**
   * The efficiency needed from now on to finish exactly on the budget
   * (the TCPI against that budget). Infinity when the money is already spent
   * and work remains; 0 when there is no work left.
   */
  breakEvenCpi: number
  outcome: WhatIfOutcome
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * A usable future CPI: finite and inside the slider's range. It is not rounded,
 * so "the current efficiency continues" gives exactly the project's own EAC.
 */
export function clampFutureCpi(value: number): number {
  if (!Number.isFinite(value)) return 1
  const { minCpi, maxCpi } = WHAT_IF_LIMITS
  return clamp(value, minCpi, maxCpi)
}

/**
 * A CPI as text for a worked formula: two decimals when that is exact, three
 * when the value sits between slider steps (such as the project's real CPI).
 */
export function formatFutureCpi(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
    ? value.toFixed(2)
    : value.toFixed(3)
}

/** A budget change kept inside the slider's range for this BAC, in whole currency units. */
export function clampBudgetChange(value: number, bac: number): number {
  if (!Number.isFinite(value) || bac <= 0) return 0
  const { minBudgetShare, maxBudgetShare } = WHAT_IF_LIMITS
  return Math.round(clamp(value, bac * minBudgetShare, bac * maxBudgetShare))
}

/**
 * Forecasts the finish for an assumed future efficiency and budget change.
 * EAC = AC + (BAC − EV) ÷ CPI(future); VAC = (BAC + change) − EAC.
 */
export function simulateForecast(totals: WhatIfTotals, input: WhatIfInput): WhatIfResult {
  const futureCpi = clampFutureCpi(input.futureCpi)
  const budget = Math.max(
    0,
    totals.bac + (Number.isFinite(input.budgetChange) ? input.budgetChange : 0)
  )
  const remainingWork = Math.max(0, totals.bac - totals.ev)
  const etc = remainingWork / futureCpi
  const eac = totals.ac + etc
  const vac = budget - eac
  const moneyLeft = budget - totals.ac

  let breakEvenCpi: number
  if (remainingWork <= 0.005) breakEvenCpi = 0
  else if (moneyLeft <= 0.005) breakEvenCpi = Infinity
  else breakEvenCpi = remainingWork / moneyLeft

  const outcome: WhatIfOutcome = vac > 0.005 ? 'under' : vac < -0.005 ? 'over' : 'on'
  return { budget, remainingWork, etc, eac, vac, breakEvenCpi, outcome }
}

/** The budget change that makes the forecast land exactly on budget at this efficiency. */
export function budgetChangeToBreakEven(totals: WhatIfTotals, futureCpi: number): number {
  const { eac } = simulateForecast(totals, { futureCpi, budgetChange: 0 })
  // Rounded to cents first so floating-point dust cannot push the result up a whole unit.
  return Math.ceil(Number((eac - totals.bac).toFixed(2)))
}
