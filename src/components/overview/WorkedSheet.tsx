import React from 'react'
import { useProjectSummary } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { formatCurrency, formatPercent } from '../../lib/utils'
import { V, WorkedSolution } from '../ui/worked'
import { buildSolutions } from '../worked/solutions'
import type { EvmMetrics } from '../../lib/calculations'

interface GivenCell {
  symbol: string
  name: string
  value: number
  note: React.ReactNode
}

function givenCells(m: EvmMetrics, count: number): GivenCell[] {
  return [
    {
      symbol: 'BAC',
      name: 'Budget at completion',
      value: m.bac,
      note: `Sum of ${count} package budget${count === 1 ? '' : 's'}`
    },
    {
      symbol: 'PV',
      name: 'Planned value',
      value: m.pv,
      note: (
        <>
          {formatPercent(m.plannedPercent)} planned × <V>BAC</V>
        </>
      )
    },
    {
      symbol: 'EV',
      name: 'Earned value',
      value: m.ev,
      note: (
        <>
          {formatPercent(m.actualPercent)} complete × <V>BAC</V>
        </>
      )
    },
    { symbol: 'AC', name: 'Actual cost', value: m.ac, note: 'Spent to date' }
  ]
}

/** Rules between cells: four across from 768px, two across (in two rows) below that. */
const cellBorder = (i: number): string =>
  i === 0 ? '' : i % 2 === 1 ? 'border-l border-rule' : 'border-rule max-md:border-t md:border-l'

/** A full-width band naming the row below it, like a textbook table's sub-head. */
const RowBand: React.FC<{ label: string; hint: string }> = ({ label, hint }) => (
  <div className="col-span-full flex flex-wrap items-baseline gap-x-3 border-y border-rule bg-subtle px-4 py-1.5 first:border-t-0 sm:px-5">
    <span className="label-caps">{label}</span>
    <span className="text-caption text-ink-3">{hint}</span>
  </div>
)

/**
 * The project's EVM worked as one sheet: the four given values, then every
 * derived metric as formula → substitution → highlighted answer.
 */
export const WorkedSheet: React.FC = () => {
  const summary = useProjectSummary()
  const currency = useAppStore((s) => s.currency)
  const solutions = buildSolutions(summary, currency)
  const rows = [
    {
      label: 'Variances & indices',
      hint: 'How the work is going now',
      items: solutions.slice(0, 4)
    },
    { label: 'Forecast', hint: 'Where it is heading', items: solutions.slice(4) }
  ]

  return (
    <section aria-labelledby="worked-sheet-title" className="overflow-hidden card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-3 sm:px-5">
        <h2 id="worked-sheet-title" className="font-display text-h2 font-semibold text-ink">
          Worked solution
        </h2>
        <p className="text-small text-ink-3">
          All 12 EVM metrics, derived step by step from the given values
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4">
        <RowBand label="Given" hint="Inputs, summed over every work package" />
        {givenCells(summary, summary.totalModules).map((cell, i) => (
          <div key={cell.symbol} className={`px-4 py-4 sm:px-5 ${cellBorder(i)}`}>
            <div className="flex items-baseline gap-1.5 text-small">
              <span className="math font-semibold italic text-ink-3">{cell.symbol}</span>
              <span className="truncate text-ink-3">{cell.name}</span>
            </div>
            <div className="mt-1 text-h1 font-semibold tracking-tight text-ink">
              {formatCurrency(cell.value, currency)}
            </div>
            <div className="math mt-0.5 text-small text-ink-3">{cell.note}</div>
          </div>
        ))}

        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <RowBand label={row.label} hint={row.hint} />
            {row.items.map((s, i) => (
              <WorkedSolution
                key={s.key}
                name={s.name}
                formula={s.formula}
                substitution={s.substitution}
                answer={s.answer}
                verdict={s.verdict}
                tone={s.tone}
                className={`px-4 py-4 sm:px-5 ${cellBorder(i)}`}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}
