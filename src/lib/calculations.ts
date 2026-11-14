export interface EvmInput {
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
}

export interface EvmMetrics {
  // 1. Foundational Inputs & Computed Values
  bac: number
  plannedPercent: number
  actualPercent: number
  pv: number
  ev: number
  ac: number

  // 2. Variances
  cv: number
  sv: number
  costStatus: 'under' | 'on-budget' | 'overrun'
  scheduleStatus: 'ahead' | 'on-schedule' | 'behind'
  /** Percentage cost variance, CV ÷ EV × 100. `null` when EV is 0 (no base to compare against). */
  cvPercent: number | null
  /** Percentage schedule variance, SV ÷ PV × 100. `null` when PV is 0. */
  svPercent: number | null

  // 3. Performance Indices
  cpi: number
  spi: number
  cpiStatus: 'efficient' | 'on-target' | 'inefficient'
  spiStatus: 'ahead' | 'on-target' | 'behind'

  // 4. Forecasting Projections
  eac: number
  etc: number
  vac: number
  /**
   * To-Complete Performance Index. `Infinity` when the budget is already spent
   * (BAC - AC <= 0) but work remains: no efficiency can finish within BAC.
   * `0` when all work is complete.
   */
  tcpi: number
  vacStatus: 'surplus' | 'balanced' | 'deficit'
  /** Percentage variance at completion, VAC ÷ BAC × 100. `null` when BAC is 0. */
  vacPercent: number | null
  tcpiStatus: 'harder' | 'target' | 'easier'

  /** True when actual cost has reached or passed BAC while work remains. */
  budgetExhausted: boolean
}

export interface CategorySummary {
  category: string
  itemCount: number
  bac: number
  pv: number
  ev: number
  ac: number
  cv: number
  sv: number
  cpi: number
  spi: number
  eac: number
  vac: number
}

export interface ProjectEvmSummary extends EvmMetrics {
  totalModules: number
  categories: CategorySummary[]
}

/** Money values closer than half a cent to zero count as zero. */
const MONEY_EPSILON = 0.005
/** Index values closer than this to 1.0 count as exactly on target. */
const INDEX_EPSILON = 1e-6

function moneyStatus<P extends string, Z extends string, N extends string>(
  value: number,
  positive: P,
  zero: Z,
  negative: N
): P | Z | N {
  if (Math.abs(value) < MONEY_EPSILON) return zero
  return value > 0 ? positive : negative
}

function indexStatus<A extends string, T extends string, B extends string>(
  value: number,
  above: A,
  target: T,
  below: B
): A | T | B {
  if (Math.abs(value - 1) < INDEX_EPSILON) return target
  return value > 1 ? above : below
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Derives every variance, index and forecast from the four aggregate inputs.
 * Shared by the per-package and project-level calculations so both follow the
 * exact same zero-division conventions:
 *
 * - CPI = EV / AC. With no cost recorded (AC = 0) CPI is taken as 1.00.
 * - SPI = EV / PV. With nothing planned yet (PV = 0) SPI is taken as 1.00.
 * - EAC = BAC / CPI. When CPI is 0 (cost but no earned value) the atypical
 *   formula EAC = AC + (BAC - EV) is used, since BAC / 0 has no finite value.
 * - TCPI = (BAC - EV) / (BAC - AC). Infinity when the budget is spent but work
 *   remains; 0 when the work is complete.
 */
function deriveFromAggregates(
  bac: number,
  pv: number,
  ev: number,
  ac: number
): Omit<EvmMetrics, 'plannedPercent' | 'actualPercent'> {
  const cv = ev - ac
  const sv = ev - pv

  // Percentage variances: the variance relative to the value it is measured against.
  const pct = (value: number, base: number): number | null =>
    base > MONEY_EPSILON ? (value / base) * 100 : null

  const cpi = ac > 0 ? ev / ac : 1
  const spi = pv > 0 ? ev / pv : 1

  const eac = cpi > 0 ? bac / cpi : ac + (bac - ev)
  const etc = Math.max(0, eac - ac)
  const vac = bac - eac

  const remainingWork = bac - ev
  const remainingBudget = bac - ac
  const workRemains = remainingWork > MONEY_EPSILON
  const budgetExhausted = workRemains && remainingBudget <= MONEY_EPSILON

  let tcpi: number
  if (!workRemains) tcpi = 0
  else if (budgetExhausted) tcpi = Infinity
  else tcpi = remainingWork / remainingBudget

  return {
    bac,
    pv,
    ev,
    ac,
    cv,
    sv,
    costStatus: moneyStatus(cv, 'under', 'on-budget', 'overrun'),
    scheduleStatus: moneyStatus(sv, 'ahead', 'on-schedule', 'behind'),
    cvPercent: pct(cv, ev),
    svPercent: pct(sv, pv),
    cpi,
    spi,
    cpiStatus: indexStatus(cpi, 'efficient', 'on-target', 'inefficient'),
    spiStatus: indexStatus(spi, 'ahead', 'on-target', 'behind'),
    eac,
    etc,
    vac,
    tcpi,
    vacStatus: moneyStatus(vac, 'surplus', 'balanced', 'deficit'),
    vacPercent: pct(vac, bac),
    tcpiStatus: indexStatus(finiteOr(tcpi, 2), 'harder', 'target', 'easier'),
    budgetExhausted
  }
}

/** Clamps raw user input into the valid EVM input domain. */
export function normalizeEvmInput(input: EvmInput): EvmInput {
  const safe = (n: number): number => (Number.isFinite(n) ? n : 0)
  return {
    bac: Math.max(0, safe(input.bac)),
    plannedPercent: Math.min(100, Math.max(0, safe(input.plannedPercent))),
    actualPercent: Math.min(100, Math.max(0, safe(input.actualPercent))),
    actualCost: Math.max(0, safe(input.actualCost))
  }
}

/**
 * Calculates the complete 12-metric Earned Value Management (EVM) model for a work package.
 */
export function calculateEvmMetrics(input: EvmInput): EvmMetrics {
  const { bac, plannedPercent, actualPercent, actualCost } = normalizeEvmInput(input)

  const pv = (plannedPercent / 100) * bac
  const ev = (actualPercent / 100) * bac

  return {
    ...deriveFromAggregates(bac, pv, ev, actualCost),
    plannedPercent,
    actualPercent
  }
}

/**
 * Aggregates all project work packages and computes project-wide EVM metrics and category breakdown.
 * Project indices come from summed PV, EV and AC, never from averaging per-package indices.
 */
export function calculateProjectEvmSummary(
  items: Array<{
    bac: number
    plannedPercent: number
    actualPercent: number
    actualCost: number
    category?: string
  }>
): ProjectEvmSummary {
  let totalBac = 0
  let totalPv = 0
  let totalEv = 0
  let totalAc = 0

  const categoryMap = new Map<
    string,
    { itemCount: number; bac: number; pv: number; ev: number; ac: number }
  >()

  for (const item of items) {
    const metrics = calculateEvmMetrics(item)
    totalBac += metrics.bac
    totalPv += metrics.pv
    totalEv += metrics.ev
    totalAc += metrics.ac

    const catName = item.category?.trim() || 'General'
    const existing = categoryMap.get(catName) || { itemCount: 0, bac: 0, pv: 0, ev: 0, ac: 0 }
    existing.itemCount += 1
    existing.bac += metrics.bac
    existing.pv += metrics.pv
    existing.ev += metrics.ev
    existing.ac += metrics.ac
    categoryMap.set(catName, existing)
  }

  const categories: CategorySummary[] = Array.from(categoryMap.entries()).map(
    ([category, data]) => {
      const m = deriveFromAggregates(data.bac, data.pv, data.ev, data.ac)
      return {
        category,
        itemCount: data.itemCount,
        bac: data.bac,
        pv: data.pv,
        ev: data.ev,
        ac: data.ac,
        cv: m.cv,
        sv: m.sv,
        cpi: m.cpi,
        spi: m.spi,
        eac: m.eac,
        vac: m.vac
      }
    }
  )

  return {
    ...deriveFromAggregates(totalBac, totalPv, totalEv, totalAc),
    plannedPercent: totalBac > 0 ? (totalPv / totalBac) * 100 : 0,
    actualPercent: totalBac > 0 ? (totalEv / totalBac) * 100 : 0,
    totalModules: items.length,
    categories
  }
}

export interface EacScenario {
  id: 'typical' | 'atypical' | 'composite'
  label: string
  formula: string
  assumption: string
  eac: number
  vac: number
}

/**
 * The three standard EAC forecasting methods. They bracket the outcome:
 * - typical:   current cost efficiency continues (EAC = BAC / CPI)
 * - atypical:  past variance was a one-off; remaining work runs at plan (EAC = AC + BAC - EV)
 * - composite: both cost and schedule pressure persist (EAC = AC + (BAC - EV) / (CPI x SPI))
 */
export function calculateEacScenarios(m: EvmMetrics): EacScenario[] {
  const remainingWork = Math.max(0, m.bac - m.ev)
  const pressure = m.cpi * m.spi
  const composite = pressure > 0 ? m.ac + remainingWork / pressure : m.ac + remainingWork

  return [
    {
      id: 'atypical',
      label: 'Variance was a one-off',
      formula: 'AC + (BAC − EV)',
      assumption: 'Remaining work is delivered at the original budgeted rate.',
      eac: m.ac + remainingWork,
      vac: m.bac - (m.ac + remainingWork)
    },
    {
      id: 'typical',
      label: 'Current efficiency continues',
      formula: 'BAC ÷ CPI',
      assumption: 'Remaining work costs what work has cost so far.',
      eac: m.eac,
      vac: m.vac
    },
    {
      id: 'composite',
      label: 'Cost and schedule pressure persist',
      formula: 'AC + (BAC − EV) ÷ (CPI × SPI)',
      assumption: 'Schedule recovery is bought with extra cost.',
      eac: composite,
      vac: m.bac - composite
    }
  ]
}

export type HealthLevel = 'healthy' | 'watch' | 'at-risk' | 'critical'

/** Thresholds used for health bands and suggestions. Shared so UI and rules never disagree. */
export const HEALTH_THRESHOLDS = {
  /** At or above this, an index counts as healthy. */
  healthy: 1.0,
  /** At or above this (and below healthy), watch it. */
  watch: 0.95,
  /** At or above this (and below watch), it is at risk. Below it is critical. */
  atRisk: 0.85
} as const

/**
 * Health band from the weaker of CPI and SPI, so a package cannot look healthy
 * while one dimension is failing.
 */
export function healthOf(cpi: number, spi: number): { level: HealthLevel; weakest: number } {
  const weakest = Math.min(cpi, spi)
  let level: HealthLevel
  if (weakest >= HEALTH_THRESHOLDS.healthy - INDEX_EPSILON) level = 'healthy'
  else if (weakest >= HEALTH_THRESHOLDS.watch) level = 'watch'
  else if (weakest >= HEALTH_THRESHOLDS.atRisk) level = 'at-risk'
  else level = 'critical'
  return { level, weakest }
}
