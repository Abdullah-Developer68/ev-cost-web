import { calculateEvmMetrics } from './calculations'
import { formatCurrency, formatIndex } from './utils'

/**
 * Unusual-spend detection: an unsupervised outlier detector over the project's
 * own work packages.
 *
 * For every package that has both earned value and actual cost, it measures the
 * cost per unit of earned value, x = AC ÷ EV ("dollars spent per dollar of
 * work done"), and compares it with the other packages using the robust
 * modified z-score of Iglewicz & Hoaglin (1993):
 *
 *     M = 0.6745 × (ln x − median(ln x)) ÷ MAD
 *
 * where MAD is the median absolute deviation of ln x. Logarithms make a package
 * that costs twice its peers and one that costs half its peers equally unusual.
 * Median and MAD are not dragged by the outlier itself the way a mean and
 * standard deviation are, which matters with a handful of packages.
 *
 * Packages with spend but no earned value (or the reverse) cannot be scored
 * against peers; they are reported as data anomalies.
 *
 * The detector is pure and deterministic: no network, no randomness, no model
 * download. The same numbers always flag the same packages, so it is testable.
 */

export type AnomalyKind =
  /** Spends far more per unit of earned value than its peers. */
  | 'overspend'
  /** Spends far less than its peers: possibly unrecorded costs or over-reported progress. */
  | 'underspend'
  /** Cost recorded but no work earned. */
  | 'spend-without-progress'
  /** Work earned but no cost recorded. */
  | 'progress-without-spend'

export type AnomalyLevel = 'unusual' | 'extreme'

export interface SpendAnomaly {
  itemId: number
  taskName: string
  category: string
  kind: AnomalyKind
  level: AnomalyLevel
  /** AC ÷ EV for this package, or null when it cannot be computed. */
  costPerValue: number | null
  /** Median AC ÷ EV of the scored packages, or null when too few to compare. */
  peerMedian: number | null
  /** Modified z-score; null for data anomalies, which are not scored against peers. */
  score: number | null
  /** Money the package spent above (overspend) or below (underspend) the peer rate. */
  gap: number
  /** One plain sentence explaining why it was flagged. */
  explanation: string
}

export interface AnomalyPoint {
  itemId: number
  taskName: string
  /** AC ÷ EV. */
  costPerValue: number
  /** Modified z-score of ln(AC ÷ EV); 0 when there were too few packages to compare. */
  score: number
  level: AnomalyLevel | null
}

export interface AnomalyReport {
  anomalies: SpendAnomaly[]
  /** Every scored package, in input order, for charting. */
  points: AnomalyPoint[]
  /** Packages that had both EV and AC, and so could be scored. */
  scored: number
  peerMedian: number | null
  /** 'too-few' when fewer than ANOMALY_RULES.minPeers packages could be scored. */
  status: 'ok' | 'too-few'
}

export const ANOMALY_RULES = {
  /** Fewer scored packages than this and the peer comparison is not meaningful. */
  minPeers: 4,
  /** |M| at or above this is unusual. Lower than the textbook 3.5 because projects are small. */
  unusualAbove: 2.5,
  /** |M| at or above this is extreme (Iglewicz & Hoaglin's outlier cut-off). */
  extremeAbove: 3.5,
  /** Makes MAD consistent with the standard deviation for normal data. */
  madConstant: 0.6745,
  /** Fallback when MAD is 0: mean absolute deviation × 1.2533 approximates σ. */
  meanAdConstant: 1.253314
} as const

export interface AnomalyInputItem {
  id: number
  taskName: string
  category?: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
}

const EPSILON = 0.005

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Modified z-scores for a sample. Uses MAD, falling back to the mean absolute
 * deviation when more than half the values are identical (MAD = 0). Returns
 * all zeros when every value is the same.
 */
export function modifiedZScores(values: number[]): number[] {
  const med = median(values)
  const deviations = values.map((v) => Math.abs(v - med))
  const mad = median(deviations)
  if (mad > 1e-12) return values.map((v) => (ANOMALY_RULES.madConstant * (v - med)) / mad)
  const meanAd = deviations.reduce((a, b) => a + b, 0) / (deviations.length || 1)
  if (meanAd > 1e-12) return values.map((v) => (v - med) / (ANOMALY_RULES.meanAdConstant * meanAd))
  return values.map(() => 0)
}

const levelOf = (absScore: number): AnomalyLevel | null =>
  absScore >= ANOMALY_RULES.extremeAbove
    ? 'extreme'
    : absScore >= ANOMALY_RULES.unusualAbove
      ? 'unusual'
      : null

export function detectSpendAnomalies(items: AnomalyInputItem[], currency = '$'): AnomalyReport {
  const money = (v: number): string => formatCurrency(v, currency)
  const rate = (v: number): string => `${currency}${formatIndex(v)}`

  const enriched = items.map((item) => ({ item, m: calculateEvmMetrics(item) }))
  const anomalies: SpendAnomaly[] = []

  // Data anomalies: cannot be compared with peers, but are unusual on their own.
  for (const { item, m } of enriched) {
    if (m.ac > EPSILON && m.ev <= EPSILON) {
      anomalies.push({
        itemId: item.id,
        taskName: item.taskName,
        category: item.category || 'General',
        kind: 'spend-without-progress',
        level: m.plannedPercent > 0 ? 'extreme' : 'unusual',
        costPerValue: null,
        peerMedian: null,
        score: null,
        gap: m.ac,
        explanation: `${money(m.ac)} has been spent but no work is reported as done.`
      })
    } else if (m.ev > EPSILON && m.ac <= EPSILON) {
      anomalies.push({
        itemId: item.id,
        taskName: item.taskName,
        category: item.category || 'General',
        kind: 'progress-without-spend',
        level: 'unusual',
        costPerValue: 0,
        peerMedian: null,
        score: null,
        gap: m.ev,
        explanation: `${money(m.ev)} of work is reported as done but no cost is recorded.`
      })
    }
  }

  const scorable = enriched.filter(({ m }) => m.ev > EPSILON && m.ac > EPSILON)
  const ratios = scorable.map(({ m }) => m.ac / m.ev)
  const peerMedian = ratios.length ? median(ratios) : null

  if (scorable.length < ANOMALY_RULES.minPeers || peerMedian === null) {
    const points = scorable.map(({ item }, i) => ({
      itemId: item.id,
      taskName: item.taskName,
      costPerValue: ratios[i],
      score: 0,
      level: null
    }))
    return {
      anomalies: rank(anomalies),
      points,
      scored: scorable.length,
      peerMedian,
      status: 'too-few'
    }
  }

  const scores = modifiedZScores(ratios.map(Math.log))
  const points: AnomalyPoint[] = scorable.map(({ item }, i) => ({
    itemId: item.id,
    taskName: item.taskName,
    costPerValue: ratios[i],
    score: scores[i],
    level: levelOf(Math.abs(scores[i]))
  }))
  scorable.forEach(({ item, m }, i) => {
    const score = scores[i]
    const level = levelOf(Math.abs(score))
    if (!level) return
    const ratio = ratios[i]
    const expected = m.ev * peerMedian
    const over = score > 0
    anomalies.push({
      itemId: item.id,
      taskName: item.taskName,
      category: item.category || 'General',
      kind: over ? 'overspend' : 'underspend',
      level,
      costPerValue: ratio,
      peerMedian,
      score,
      gap: Math.abs(m.ac - expected),
      explanation: over
        ? `Spends ${rate(ratio)} per ${currency}1 of work done, against a typical ${rate(peerMedian)} across the project: about ${money(m.ac - expected)} more than its peers would have spent for the same work.`
        : `Spends only ${rate(ratio)} per ${currency}1 of work done, against a typical ${rate(peerMedian)}: about ${money(expected - m.ac)} less than expected. Check for unrecorded costs or over-reported progress.`
    })
  })

  return { anomalies: rank(anomalies), points, scored: scorable.length, peerMedian, status: 'ok' }
}

/** Extreme before unusual, then by the money involved. Stable for equal keys. */
function rank(list: SpendAnomaly[]): SpendAnomaly[] {
  return [...list].sort(
    (a, b) => Number(b.level === 'extreme') - Number(a.level === 'extreme') || b.gap - a.gap
  )
}

export const ANOMALY_KIND_LABEL: Record<AnomalyKind, string> = {
  overspend: 'Unusually high spend',
  underspend: 'Unusually low spend',
  'spend-without-progress': 'Spend with no progress',
  'progress-without-spend': 'Progress with no spend'
}

/** A short narrative summary of the detector's findings, for the report and the screen. */
export function summarizeAnomalies(report: AnomalyReport, currency = '$'): string {
  const { anomalies, scored, peerMedian, status } = report
  const typical =
    peerMedian !== null
      ? ` The typical package spends ${currency}${formatIndex(peerMedian)} per ${currency}1 of work done.`
      : ''
  if (anomalies.length === 0) {
    return status === 'too-few'
      ? `Only ${scored} package${scored === 1 ? ' has' : 's have'} both progress and cost, so there are too few to compare (at least ${ANOMALY_RULES.minPeers} are needed).`
      : `No unusual spending found across ${scored} packages.${typical}`
  }
  const extreme = anomalies.filter((a) => a.level === 'extreme').length
  const top = anomalies[0]
  const lead = `${anomalies.length} package${anomalies.length === 1 ? '' : 's'} flagged${extreme ? ` (${extreme} extreme)` : ''}.`
  return `${lead}${typical} Look first at ${top.taskName}. ${top.explanation}`
}
