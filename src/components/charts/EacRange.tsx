import React, { useMemo } from 'react'
import { useProjectSummary } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { calculateEacScenarios } from '../../lib/calculations'
import { Panel } from '../ui/panel'
import { V } from '../ui/worked'
import { cn, formatCompactCurrency, formatCurrency, formatSignedCurrency } from '../../lib/utils'

const FORMULAS: Record<string, React.ReactNode> = {
  atypical: (
    <>
      <V>AC</V> + (<V>BAC</V> − <V>EV</V>)
    </>
  ),
  typical: (
    <>
      <V>BAC</V> ÷ <V>CPI</V>
    </>
  ),
  composite: (
    <>
      <V>AC</V> + (<V>BAC</V> − <V>EV</V>) ÷ (<V>CPI</V> × <V>SPI</V>)
    </>
  )
}

/**
 * The three standard EAC methods on one axis against the budget line, so the
 * forecast reads as a range instead of a single falsely precise number.
 */
export const EacRange: React.FC = () => {
  const summary = useProjectSummary()
  const currency = useAppStore((s) => s.currency)
  const scenarios = useMemo(() => calculateEacScenarios(summary), [summary])

  const values = [summary.bac, ...scenarios.map((s) => s.eac)].filter(Number.isFinite)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max((hi - lo) * 0.18, summary.bac * 0.02, 1)
  const min = Math.max(0, lo - pad)
  const max = hi + pad
  const pos = (v: number): string => `${((v - min) / (max - min)) * 100}%`
  const sorted = [...scenarios].sort((a, b) => a.eac - b.eac)

  return (
    <Panel
      title="Where the project could finish"
      subtitle="Three standard ways to forecast the final cost (EAC). Each assumes something different about the remaining work."
    >
      <div
        className="relative mx-2 mb-2 mt-12 h-10"
        role="img"
        aria-label={`Forecast range ${formatCurrency(sorted[0].eac, currency)} to ${formatCurrency(sorted[2].eac, currency)} against a budget of ${formatCurrency(summary.bac, currency)}`}
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-rule-strong" aria-hidden />
        <span
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-subtle-2"
          style={{
            left: pos(sorted[0].eac),
            width: `calc(${pos(sorted[2].eac)} - ${pos(sorted[0].eac)})`
          }}
          aria-hidden
        />
        <div
          className="absolute -top-11 bottom-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: pos(summary.bac) }}
        >
          <span className="whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-caption font-medium text-primary-fg">
            Budget {formatCompactCurrency(summary.bac, currency)}
          </span>
          <span className="w-0.5 flex-1 bg-ink" aria-hidden />
        </div>
        {sorted.map((s, i) => (
          <div
            key={s.id}
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: pos(s.eac) }}
          >
            <span
              className={cn(
                'size-3.5 rounded-full ring-2 ring-paper',
                s.eac > summary.bac + 0.005 ? 'bg-[var(--series-unfav)]' : 'bg-[var(--series-fav)]'
              )}
              aria-hidden
            />
            <span
              className={cn(
                'num absolute whitespace-nowrap text-caption font-semibold text-ink-2',
                i === 1 ? 'bottom-5' : 'top-5'
              )}
            >
              {formatCompactCurrency(s.eac, currency)}
            </span>
          </div>
        ))}
      </div>

      <table className="mt-6 w-full border-collapse text-small">
        <thead>
          <tr className="border-b border-rule text-left text-ink-3">
            <th className="py-1.5 pr-3 font-semibold">If…</th>
            <th className="py-1.5 pr-3 font-semibold">Formula</th>
            <th className="py-1.5 pr-3 text-right font-semibold">EAC</th>
            <th className="whitespace-nowrap py-1.5 text-right font-semibold">vs budget</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.id} className="border-b border-rule last:border-0 align-top">
              <td className="py-2 pr-3">
                <div className="font-semibold text-ink">{s.label}</div>
                <div className="text-caption text-ink-3">{s.assumption}</div>
              </td>
              <td className="math py-2 pr-3 text-small text-ink">{FORMULAS[s.id]}</td>
              <td className="num py-2 pr-3 text-right font-semibold text-ink">
                {s.id === 'typical' ? (
                  <span className="answer">{formatCurrency(s.eac, currency)}</span>
                ) : (
                  formatCurrency(s.eac, currency)
                )}
              </td>
              <td
                className={cn(
                  'num py-2 text-right font-semibold',
                  s.vac < -0.005 ? 'text-bad' : 'text-good'
                )}
              >
                {formatSignedCurrency(s.vac, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
