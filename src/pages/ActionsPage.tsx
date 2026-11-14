import React, { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useSuggestions } from '../hooks/useEvm'
import { useCostStore } from '../store/useCostStore'
import { countBySeverity, SUGGESTION_RULES, SuggestionSeverity } from '../lib/suggestions'
import { HEALTH_THRESHOLDS } from '../lib/calculations'
import { formatIndex } from '../lib/utils'
import { SEVERITY_META, SeverityTag } from '../components/ui/status'
import { EmptyState, Panel } from '../components/ui/panel'
import { V } from '../components/ui/worked'
import { ActionTitle, TriggerChips } from '../components/overview/NextActionsPanel'
import { EacRange } from '../components/charts/EacRange'
import { WhatIfPanel } from '../components/actions/WhatIfPanel'
import { UnusualSpendPanel } from '../components/anomalies/UnusualSpendPanel'
import { EmptyProject } from '../components/overview/EmptyProject'
import { cn } from '../lib/utils'

const ORDER: SuggestionSeverity[] = ['critical', 'warning', 'info', 'positive']

const RulesPanel: React.FC = () => {
  const r = SUGGESTION_RULES
  const rows: Array<[React.ReactNode, React.ReactNode, SuggestionSeverity]> = [
    [
      <>
        <V>CPI</V> or <V>SPI</V> below {formatIndex(r.criticalBelow)}
      </>,
      'Recover or re-scope the package',
      'critical'
    ],
    [
      <>
        <V>AC</V> ≥ <V>BAC</V> with work left
      </>,
      'Re-baseline: the budget is spent',
      'critical'
    ],
    [
      <>
        <V>CPI</V> or <V>SPI</V> below {formatIndex(r.warnBelow)}
      </>,
      'Control cost, or add capacity',
      'warning'
    ],
    [
      <>
        <V>TCPI</V> − <V>CPI</V> above {formatIndex(r.tcpiGap)}
      </>,
      'Treat BAC as unreachable; report against EAC',
      'warning'
    ],
    [
      <>One package ≥ {formatIndex(r.hotspotShare * 100, 0)}% of total overrun</>,
      'Fix that package first',
      'info'
    ],
    [<>Spend recorded with 0% progress</>, 'Check the progress data', 'info'],
    [
      <>
        <V>CPI</V> ≥ {formatIndex(r.strongAbove)} and <V>SPI</V> ≥ 1.00
      </>,
      'Hold course; lend capacity to slipping work',
      'positive'
    ]
  ]
  return (
    <Panel
      title="The rules"
      subtitle="Suggestions come from fixed thresholds, not guesswork: the same numbers always give the same advice."
      bodyClassName="px-0 pb-2"
    >
      <table className="w-full border-separate border-spacing-0 text-small">
        <thead>
          <tr className="text-left text-ink-3">
            <th className="border-b border-rule py-2 pl-5 pr-3 font-semibold">When</th>
            <th className="border-b border-rule px-3 py-2 font-semibold">Advice</th>
            <th className="border-b border-rule py-2 pl-3 pr-5 font-semibold">Level</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([when, advice, sev], i) => (
            <tr key={i}>
              <td className="border-b border-rule py-2 pl-5 pr-3 text-body text-ink">{when}</td>
              <td className="border-b border-rule px-3 py-2 text-ink-2">{advice}</td>
              <td className="border-b border-rule py-2 pl-3 pr-5">
                <SeverityTag severity={sev} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 pt-3 text-caption text-ink-3">
        Health bands use the weaker of CPI and SPI: on track ≥{' '}
        {formatIndex(HEALTH_THRESHOLDS.healthy)}, watch ≥ {formatIndex(HEALTH_THRESHOLDS.watch)}, at
        risk ≥ {formatIndex(HEALTH_THRESHOLDS.atRisk)}, critical below.
      </p>
    </Panel>
  )
}

export const ActionsPage: React.FC = () => {
  const suggestions = useSuggestions()
  const items = useCostStore((s) => s.items)
  const isBooting = useCostStore((s) => s.isBooting)
  const activeProjectId = useCostStore((s) => s.activeProjectId)
  const [filter, setFilter] = useState<SuggestionSeverity | 'all'>('all')

  if (isBooting) return <div className="skeleton h-[480px]" aria-busy="true" />
  if (items.length === 0) return <EmptyProject />

  const counts = countBySeverity(suggestions)
  const visible = filter === 'all' ? suggestions : suggestions.filter((s) => s.severity === filter)

  return (
    <div className="grid items-start gap-6 min-[1360px]:grid-cols-[minmax(0,1fr)_440px]">
      <section aria-labelledby="actions-heading" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="actions-heading" className="font-display text-h2 font-semibold text-ink">
              Next actions
            </h2>
            <p className="text-body text-ink-3">Most severe first, then by the money at stake.</p>
          </div>
          <div
            role="group"
            aria-label="Filter by level"
            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-subtle-2 p-0.5"
          >
            {(['all', ...ORDER] as const).map((key) => {
              const active = filter === key
              const count = key === 'all' ? suggestions.length : counts[key]
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-small font-medium transition-colors disabled:opacity-40',
                    active ? 'bg-paper text-ink shadow-panel' : 'text-ink-2 hover:text-ink'
                  )}
                >
                  {key === 'all' ? 'All' : SEVERITY_META[key].label}
                  <span className={cn('num', 'text-ink-3')}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="Nothing at this level"
              body="Pick another level to see the rest."
            />
          </div>
        ) : (
          <ol className="space-y-3">
            {visible.map((s) => (
              <li key={s.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="math text-h3 font-bold text-ink-3" aria-hidden>
                    {suggestions.indexOf(s) + 1}.
                  </span>
                  <ActionTitle
                    suggestion={s}
                    className="font-display text-h3 font-semibold text-ink"
                  />
                  <SeverityTag severity={s.severity} className="self-center" />
                </div>
                <p className="mt-1.5 max-w-[75ch] text-body text-ink-2">
                  <span className="font-semibold text-ink">
                    {s.scope === 'project' ? 'Whole project' : s.itemName}.
                  </span>{' '}
                  {s.detail}
                </p>
                <ol className="mt-3 max-w-[75ch] list-decimal space-y-1 pl-5 text-body text-ink marker:font-semibold marker:text-ink-3">
                  {s.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="mt-3">
                  <TriggerChips suggestion={s} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="space-y-6">
        <UnusualSpendPanel />
        <EacRange />
        {/* Keyed by project so a plan tried on one project does not carry over to another */}
        <WhatIfPanel key={activeProjectId ?? 'none'} />
        <RulesPanel />
      </div>
    </div>
  )
}
