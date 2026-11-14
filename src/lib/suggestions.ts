import {
  calculateEacScenarios,
  calculateEvmMetrics,
  calculateProjectEvmSummary,
  EvmMetrics,
  HEALTH_THRESHOLDS
} from './calculations'
import { formatCurrency, formatIndex } from './utils'

/**
 * Rule-based recommendation engine.
 *
 * Every suggestion is deterministic and traceable: it names the metric that
 * triggered it, the threshold it crossed and (when relevant) the work package
 * it applies to. No network, no randomness, so the same numbers always
 * produce the same advice and the rules can be unit-tested.
 */

export type SuggestionSeverity = 'critical' | 'warning' | 'info' | 'positive'
export type SuggestionCategory = 'cost' | 'schedule' | 'forecast' | 'opportunity' | 'data'

export interface SuggestionTrigger {
  metric: 'CPI' | 'SPI' | 'TCPI' | 'VAC' | 'CV' | 'SV' | 'AC' | 'EV' | 'Progress'
  value: string
  rule: string
}

export interface Suggestion {
  /** Stable key, unique within one result set. */
  id: string
  severity: SuggestionSeverity
  category: SuggestionCategory
  scope: 'project' | 'package'
  itemId?: number
  itemName?: string
  /** Imperative action headline, e.g. "Re-scope Enterprise SSO". */
  title: string
  /** Why: the numbers behind the advice. */
  detail: string
  /** Concrete next steps. */
  steps: string[]
  triggers: SuggestionTrigger[]
  /** Money at stake, used to rank suggestions of equal severity. */
  impact: number
}

export interface SuggestionInputItem {
  id: number
  taskName: string
  category?: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
}

export const SUGGESTION_RULES = {
  /** An index below this is a warning. */
  warnBelow: HEALTH_THRESHOLDS.watch,
  /** An index below this is critical. */
  criticalBelow: 0.8,
  /** TCPI above CPI by more than this means BAC is no longer a realistic target. */
  tcpiGap: 0.1,
  /** Index at or above this marks a package with capacity or budget to spare. */
  strongAbove: 1.05,
  /** Share of total overrun that marks a single package as the hotspot. */
  hotspotShare: 0.5
} as const

const SEVERITY_RANK: Record<SuggestionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3
}

function severityFromIndex(value: number): SuggestionSeverity | null {
  if (value < SUGGESTION_RULES.criticalBelow) return 'critical'
  if (value < SUGGESTION_RULES.warnBelow) return 'warning'
  return null
}

function worse(
  a: SuggestionSeverity | null,
  b: SuggestionSeverity | null
): SuggestionSeverity | null {
  if (!a) return b
  if (!b) return a
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b
}

function short(name: string, max = 56): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name
}

function packageSuggestions(
  item: SuggestionInputItem,
  m: EvmMetrics,
  currency: string
): Suggestion[] {
  const out: Suggestion[] = []
  const money = (n: number): string => formatCurrency(n, currency)
  const name = short(item.taskName)
  const base = { scope: 'package' as const, itemId: item.id, itemName: item.taskName }

  // Data quality: these make every derived number unreliable, so flag them first.
  if (m.ac > 0 && m.actualPercent === 0) {
    out.push({
      ...base,
      id: `pkg-${item.id}-no-progress`,
      severity: m.plannedPercent > 0 ? 'warning' : 'info',
      category: 'data',
      title: `Record progress on ${name}`,
      detail: `${money(m.ac)} has been spent but 0% of the work is marked complete, so CPI is 0 and every forecast for this package is pessimistic.`,
      steps: [
        'Confirm the real percent complete with the package owner.',
        'If no work was delivered, find out what the spend bought before approving more.'
      ],
      triggers: [{ metric: 'Progress', value: '0%', rule: 'AC > 0 while actual % = 0' }],
      impact: m.ac
    })
    return out
  }

  if (m.ac === 0 && m.actualPercent > 0) {
    out.push({
      ...base,
      id: `pkg-${item.id}-no-cost`,
      severity: 'info',
      category: 'data',
      title: `Log actual costs for ${name}`,
      detail: `${formatIndex(m.actualPercent, 0)}% of the work is complete but no cost is recorded. CPI defaults to 1.00, which hides any overrun.`,
      steps: ['Enter timesheet and expense totals to date as the actual cost (AC).'],
      triggers: [{ metric: 'AC', value: money(0), rule: 'AC = 0 while actual % > 0' }],
      impact: m.ev
    })
  }

  const complete = m.actualPercent >= 100
  if (complete) {
    if (m.cv < 0) {
      out.push({
        ...base,
        id: `pkg-${item.id}-closed-over`,
        severity: 'info',
        category: 'cost',
        title: `Run a cost retrospective on ${name}`,
        detail: `Finished at ${money(m.ac)} against a ${money(m.bac)} budget (CPI ${formatIndex(m.cpi)}). The ${money(-m.cv)} overrun is final.`,
        steps: [
          'Record what drove the overrun so the next estimate absorbs it.',
          'Check whether the same driver affects packages still in progress.'
        ],
        triggers: [{ metric: 'CV', value: money(m.cv), rule: 'Work complete with CV < 0' }],
        impact: -m.cv
      })
    } else if (m.cv > 0) {
      out.push({
        ...base,
        id: `pkg-${item.id}-closed-under`,
        severity: 'positive',
        category: 'opportunity',
        title: `Release ${money(m.cv)} from ${name}`,
        detail: `Finished under budget (CPI ${formatIndex(m.cpi)}). The unspent ${money(m.cv)} can return to the project reserve.`,
        steps: ['Move the surplus to the contingency reserve or to a package that is over budget.'],
        triggers: [{ metric: 'CV', value: money(m.cv), rule: 'Work complete with CV > 0' }],
        impact: m.cv
      })
    }
    return out
  }

  // Budget already spent with work outstanding: no efficiency can recover it.
  if (m.budgetExhausted) {
    out.push({
      ...base,
      id: `pkg-${item.id}-budget-exhausted`,
      severity: 'critical',
      category: 'forecast',
      title: `Re-baseline ${name}: its budget is spent`,
      detail: `Actual cost ${money(m.ac)} has reached the ${money(m.bac)} budget with ${formatIndex(100 - m.actualPercent, 0)}% of the work left. Finishing within BAC is impossible (TCPI ∞).`,
      steps: [
        `Approve a new budget based on the forecast EAC of ${money(m.eac)}, or cut the remaining scope.`,
        'Freeze discretionary spend on this package until the new baseline is agreed.'
      ],
      triggers: [{ metric: 'TCPI', value: '∞', rule: 'AC ≥ BAC while work remains' }],
      impact: Math.abs(m.vac)
    })
    return out
  }

  // The four EVM quadrants, read from CPI and SPI together.
  const costSeverity = severityFromIndex(m.cpi)
  const scheduleSeverity = severityFromIndex(m.spi)
  const severity = worse(costSeverity, scheduleSeverity)
  const cpiTrigger: SuggestionTrigger = {
    metric: 'CPI',
    value: formatIndex(m.cpi),
    rule: `CPI < ${formatIndex(costSeverity === 'critical' ? SUGGESTION_RULES.criticalBelow : SUGGESTION_RULES.warnBelow)}`
  }
  const spiTrigger: SuggestionTrigger = {
    metric: 'SPI',
    value: formatIndex(m.spi),
    rule: `SPI < ${formatIndex(scheduleSeverity === 'critical' ? SUGGESTION_RULES.criticalBelow : SUGGESTION_RULES.warnBelow)}`
  }

  if (costSeverity && scheduleSeverity && severity) {
    const unrealistic = m.tcpi - m.cpi > SUGGESTION_RULES.tcpiGap
    out.push({
      ...base,
      id: `pkg-${item.id}-behind-over`,
      severity,
      category: 'cost',
      title: unrealistic ? `Re-scope ${name}` : `Recover ${name}`,
      detail: `Behind schedule and over budget: each ${currency}1.00 spent earns ${currency}${formatIndex(m.cpi)}, and ${money(-m.sv)} of planned work is not done. Forecast EAC is ${money(m.eac)} against ${money(m.bac)}.`,
      steps: unrealistic
        ? [
            `Finishing on budget needs TCPI ${formatIndex(m.tcpi)}, well above the ${formatIndex(m.cpi)} achieved so far. Treat BAC as unreachable.`,
            'Cut or defer lower-value scope, or re-baseline to the EAC with sponsor approval.',
            'Review this package weekly until CPI is back above 0.95.'
          ]
        : [
            `Finishing on budget needs TCPI ${formatIndex(m.tcpi)}; that is achievable with tighter cost control.`,
            'Find the cost driver (rework, idle time, rates) and fix it before adding people.',
            'Re-plan the remaining tasks in smaller increments to recover schedule.'
          ],
      triggers: [
        cpiTrigger,
        spiTrigger,
        ...(unrealistic
          ? [
              {
                metric: 'TCPI' as const,
                value: formatIndex(m.tcpi),
                rule: `TCPI − CPI > ${formatIndex(SUGGESTION_RULES.tcpiGap)}`
              }
            ]
          : [])
      ],
      impact: Math.abs(Math.min(m.vac, 0)) + Math.abs(Math.min(m.sv, 0))
    })
  } else if (costSeverity) {
    out.push({
      ...base,
      id: `pkg-${item.id}-over-budget`,
      severity: costSeverity,
      category: 'cost',
      title: `Control spend on ${name}`,
      detail: `${m.spi >= 1 ? 'On or ahead of schedule but' : 'Roughly on schedule but'} over budget: CPI ${formatIndex(m.cpi)} forecasts ${money(m.eac)} against ${money(m.bac)} (VAC ${money(m.vac)}).`,
      steps: [
        m.spi >= SUGGESTION_RULES.strongAbove
          ? 'Schedule gains may be bought with overtime or premium resources; check whether the pace is worth the cost.'
          : 'Review the cost drivers: rates, rework and scope creep.',
        `Finishing on budget needs TCPI ${formatIndex(m.tcpi)} on the remaining work.`
      ],
      triggers: [cpiTrigger],
      impact: Math.abs(Math.min(m.vac, 0))
    })
  } else if (scheduleSeverity) {
    out.push({
      ...base,
      id: `pkg-${item.id}-behind`,
      severity: scheduleSeverity,
      category: 'schedule',
      title: `Add capacity to ${name}`,
      detail: `Under or on budget but behind schedule: SPI ${formatIndex(m.spi)} means ${money(-m.sv)} of planned work is not done. Cost efficiency (CPI ${formatIndex(m.cpi)}) leaves room to speed up.`,
      steps: [
        'Check for blockers and dependencies holding the work back.',
        'Add people or move capacity from a package that is ahead; the budget can absorb it.'
      ],
      triggers: [spiTrigger],
      impact: Math.abs(Math.min(m.sv, 0))
    })
  } else if (
    m.cpi >= SUGGESTION_RULES.strongAbove &&
    m.spi >= 1 &&
    m.actualPercent > 0 &&
    m.actualPercent < 100
  ) {
    out.push({
      ...base,
      id: `pkg-${item.id}-strong`,
      severity: 'positive',
      category: 'opportunity',
      title: `Keep ${name} on its current plan`,
      detail: `Ahead of schedule (SPI ${formatIndex(m.spi)}) and under budget (CPI ${formatIndex(m.cpi)}), forecasting a ${money(m.vac)} surplus.`,
      steps: [
        'Hold the current team and approach.',
        'Share what works here with packages that are behind.'
      ],
      triggers: [
        {
          metric: 'CPI',
          value: formatIndex(m.cpi),
          rule: `CPI ≥ ${formatIndex(SUGGESTION_RULES.strongAbove)}`
        },
        { metric: 'SPI', value: formatIndex(m.spi), rule: 'SPI ≥ 1.00' }
      ],
      impact: Math.max(0, m.vac)
    })
  }

  return out
}

function projectSuggestions(
  items: SuggestionInputItem[],
  enriched: Array<{ item: SuggestionInputItem; m: EvmMetrics }>,
  currency: string
): Suggestion[] {
  const out: Suggestion[] = []
  const money = (n: number): string => formatCurrency(n, currency)
  const p = calculateProjectEvmSummary(items)
  const base = { scope: 'project' as const }

  const costSeverity = severityFromIndex(p.cpi)
  if (costSeverity) {
    const [best, , worst] = calculateEacScenarios(p)
    out.push({
      ...base,
      id: 'project-forecast-overrun',
      severity: costSeverity,
      category: 'forecast',
      title: `Plan for a ${money(-p.vac)} project overrun`,
      detail: `Project CPI is ${formatIndex(p.cpi)}. At this efficiency the project finishes at ${money(p.eac)} against a ${money(p.bac)} budget. Depending on what happens next, EAC ranges from ${money(best.eac)} to ${money(worst.eac)}.`,
      steps: [
        `Raise the forecast with the sponsor now and request ${money(-p.vac)} of contingency, or agree on scope cuts.`,
        'Fix the packages listed below with the largest cost variance first.'
      ],
      triggers: [
        {
          metric: 'CPI',
          value: formatIndex(p.cpi),
          rule: `Project CPI < ${formatIndex(SUGGESTION_RULES.warnBelow)}`
        },
        { metric: 'VAC', value: money(p.vac), rule: 'VAC < 0' }
      ],
      impact: Math.abs(p.vac) + 1 // project-level outranks a package of equal size
    })
  }

  const scheduleSeverity = severityFromIndex(p.spi)
  if (scheduleSeverity) {
    out.push({
      ...base,
      id: 'project-behind',
      severity: scheduleSeverity,
      category: 'schedule',
      title: `Recover ${money(-p.sv)} of slipped work`,
      detail: `Project SPI is ${formatIndex(p.spi)}: the team has delivered ${formatIndex(p.spi * 100, 0)}% of the work planned by now.`,
      steps: [
        'Re-sequence the remaining work to protect the critical deliverables.',
        'Move capacity from packages that are ahead to the ones that are furthest behind.'
      ],
      triggers: [
        {
          metric: 'SPI',
          value: formatIndex(p.spi),
          rule: `Project SPI < ${formatIndex(SUGGESTION_RULES.warnBelow)}`
        }
      ],
      impact: Math.abs(p.sv) + 1
    })
  }

  if (p.budgetExhausted) {
    out.push({
      ...base,
      id: 'project-budget-exhausted',
      severity: 'critical',
      category: 'forecast',
      title: 'Re-baseline the project: the budget is spent',
      detail: `Actual cost ${money(p.ac)} has reached the ${money(p.bac)} budget while ${formatIndex(100 - p.actualPercent, 0)}% of the work remains.`,
      steps: [
        'Freeze new commitments.',
        `Agree on a new budget of at least ${money(p.eac)} or cut scope.`
      ],
      triggers: [{ metric: 'TCPI', value: '∞', rule: 'Project AC ≥ BAC while work remains' }],
      impact: Math.abs(p.vac) + 2
    })
  } else if (p.ev < p.bac && p.tcpi - p.cpi > SUGGESTION_RULES.tcpiGap && p.cpi < 1) {
    out.push({
      ...base,
      id: 'project-tcpi-unrealistic',
      severity: 'warning',
      category: 'forecast',
      title: 'Stop reporting against the original budget',
      detail: `Finishing within ${money(p.bac)} needs every remaining ${currency}1 to earn ${currency}${formatIndex(p.tcpi)} (TCPI), but the project has achieved only ${formatIndex(p.cpi)} so far. That gap is rarely closed.`,
      steps: [`Report against EAC ${money(p.eac)} until a new baseline is approved.`],
      triggers: [
        {
          metric: 'TCPI',
          value: formatIndex(p.tcpi),
          rule: `TCPI − CPI > ${formatIndex(SUGGESTION_RULES.tcpiGap)}`
        }
      ],
      impact: Math.abs(Math.min(p.vac, 0))
    })
  }

  // Hotspot: one package drives most of the cost overrun.
  const overruns = enriched.filter((e) => e.m.cv < 0)
  const totalOverrun = overruns.reduce((sum, e) => sum + -e.m.cv, 0)
  if (overruns.length >= 2 && totalOverrun > 0) {
    const top = overruns.reduce((a, b) => (a.m.cv < b.m.cv ? a : b))
    const share = -top.m.cv / totalOverrun
    if (share >= SUGGESTION_RULES.hotspotShare) {
      out.push({
        ...base,
        id: 'project-hotspot',
        itemId: top.item.id,
        itemName: top.item.taskName,
        severity: 'info',
        category: 'cost',
        title: `Focus on ${short(top.item.taskName)} first`,
        detail: `It accounts for ${formatIndex(share * 100, 0)}% (${money(-top.m.cv)}) of the ${money(totalOverrun)} total cost overrun across ${overruns.length} packages.`,
        steps: ['Fixing this one package recovers more than all the others combined.'],
        triggers: [
          {
            metric: 'CV',
            value: money(top.m.cv),
            rule: `Share of total overrun ≥ ${formatIndex(SUGGESTION_RULES.hotspotShare * 100, 0)}%`
          }
        ],
        impact: -top.m.cv
      })
    }
  }

  // Rebalance: a donor that is ahead and efficient, a receiver that is behind.
  const inProgress = enriched.filter((e) => e.m.actualPercent > 0 && e.m.actualPercent < 100)
  const donors = inProgress
    .filter((e) => e.m.spi >= SUGGESTION_RULES.strongAbove && e.m.cpi >= 1)
    .sort((a, b) => b.m.spi - a.m.spi)
  const receivers = enriched
    .filter((e) => e.m.actualPercent < 100 && e.m.spi < SUGGESTION_RULES.warnBelow)
    .sort((a, b) => a.m.sv - b.m.sv)
  if (donors.length > 0 && receivers.length > 0) {
    const donor = donors[0]
    const receiver = receivers[0]
    out.push({
      ...base,
      id: `project-rebalance-${donor.item.id}-${receiver.item.id}`,
      severity: 'info',
      category: 'opportunity',
      title: `Move capacity from ${short(donor.item.taskName, 28)} to ${short(receiver.item.taskName, 28)}`,
      detail: `${short(donor.item.taskName)} is ahead (SPI ${formatIndex(donor.m.spi)}) and under budget, while ${short(receiver.item.taskName)} is ${money(-receiver.m.sv)} behind plan (SPI ${formatIndex(receiver.m.spi)}).`,
      steps: ['Lend one contributor for the next iteration, then re-measure both packages.'],
      triggers: [
        {
          metric: 'SPI',
          value: formatIndex(donor.m.spi),
          rule: `Donor SPI ≥ ${formatIndex(SUGGESTION_RULES.strongAbove)} and CPI ≥ 1.00`
        },
        {
          metric: 'SPI',
          value: formatIndex(receiver.m.spi),
          rule: `Receiver SPI < ${formatIndex(SUGGESTION_RULES.warnBelow)}`
        }
      ],
      impact: Math.abs(receiver.m.sv)
    })
  }

  if (out.length === 0 && p.cpi >= 1 && p.spi >= 1 && p.ev > 0) {
    out.push({
      ...base,
      id: 'project-healthy',
      severity: 'positive',
      category: 'forecast',
      title: 'Hold course',
      detail: `The project is on or under budget (CPI ${formatIndex(p.cpi)}) and on or ahead of schedule (SPI ${formatIndex(p.spi)}). Forecast EAC is ${money(p.eac)}.`,
      steps: ['Keep the current cadence and re-check after the next status update.'],
      triggers: [
        { metric: 'CPI', value: formatIndex(p.cpi), rule: 'CPI ≥ 1.00' },
        { metric: 'SPI', value: formatIndex(p.spi), rule: 'SPI ≥ 1.00' }
      ],
      impact: 0
    })
  }

  return out
}

/**
 * Produces a ranked list of suggestions for a project: most severe first, then
 * the largest money at stake.
 */
export function generateSuggestions(items: SuggestionInputItem[], currency = '$'): Suggestion[] {
  if (items.length === 0) {
    return [
      {
        id: 'project-empty',
        severity: 'info',
        category: 'data',
        scope: 'project',
        title: 'Add your first work package',
        detail:
          'Suggestions appear once the project has at least one work package with a budget and progress.',
        steps: ['Add a work package, or import a CSV or Excel sheet.'],
        triggers: [],
        impact: 0
      }
    ]
  }

  const enriched = items.map((item) => ({ item, m: calculateEvmMetrics(item) }))
  const all = [
    ...projectSuggestions(items, enriched, currency),
    ...enriched.flatMap(({ item, m }) => packageSuggestions(item, m, currency))
  ]

  return all.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.impact - a.impact
  )
}

/** Counts suggestions per severity, for badges and summaries. */
export function countBySeverity(suggestions: Suggestion[]): Record<SuggestionSeverity, number> {
  const counts: Record<SuggestionSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    positive: 0
  }
  for (const s of suggestions) counts[s.severity] += 1
  return counts
}
