import React from 'react'
import { AlertTriangle, OctagonAlert, ScanSearch } from 'lucide-react'
import { useAnomalies } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import {
  ANOMALY_KIND_LABEL,
  ANOMALY_RULES,
  summarizeAnomalies,
  type AnomalyLevel
} from '../../lib/anomalies'
import { cn, formatIndex, truncate } from '../../lib/utils'
import { Panel } from '../ui/panel'
import { V } from '../ui/worked'

const LEVEL_META: Record<AnomalyLevel, { label: string; icon: typeof AlertTriangle; cls: string }> =
  {
    extreme: { label: 'Extreme', icon: OctagonAlert, cls: 'text-bad bg-bad-bg' },
    unusual: { label: 'Unusual', icon: AlertTriangle, cls: 'text-risk bg-risk-bg' }
  }

export const AnomalyTag: React.FC<{ level: AnomalyLevel }> = ({ level }) => {
  const meta = LEVEL_META[level]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption font-semibold',
        meta.cls
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

/**
 * Unusual-spend detection: flags packages whose cost per unit of earned value
 * is out of line with the rest of the project (robust modified z-score).
 */
export const UnusualSpendPanel: React.FC = () => {
  const report = useAnomalies()
  const currency = useAppStore((s) => s.currency)
  const items = useCostStore((s) => s.items)
  const setInspectedItem = useAppStore((s) => s.setInspectedItem)
  const open = (id: number): void => {
    const item = items.find((i) => i.id === id)
    if (item) setInspectedItem(item)
  }

  const maxRatio = Math.max(
    report.peerMedian ?? 1,
    ...report.points.map((p) => p.costPerValue),
    0.01
  )
  const pct = (v: number): string => `${Math.min(100, (v / maxRatio) * 100)}%`

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <ScanSearch className="size-4 text-ink-3" aria-hidden />
          Unusual spend
        </span>
      }
      subtitle="Anomaly detection: each package's cost per unit of work done, compared with the rest of the project."
    >
      <p className="text-body text-ink" aria-live="polite">
        {summarizeAnomalies(report, currency)}
      </p>

      {report.points.length > 0 && (
        <figure className="mt-4">
          <figcaption className="mb-2 flex items-baseline justify-between text-caption text-ink-3">
            <span>
              Spent per {currency}1 of work done (<V>AC</V> ÷ <V>EV</V>)
            </span>
            {report.peerMedian !== null && (
              <span>
                <span className="mr-1 inline-block h-3 w-px translate-y-0.5 bg-ink" aria-hidden />
                typical {currency}
                {formatIndex(report.peerMedian)}
              </span>
            )}
          </figcaption>
          <ul className="space-y-1.5">
            {report.points.map((p) => (
              <li
                key={p.itemId}
                className="grid grid-cols-[minmax(0,120px)_1fr_44px] items-center gap-2 text-small"
              >
                <button
                  type="button"
                  onClick={() => open(p.itemId)}
                  className="truncate text-left text-ink-2 hover:text-ink hover:underline"
                  title={p.taskName}
                >
                  {truncate(p.taskName, 26)}
                </button>
                <div className="relative h-3 rounded-sm bg-subtle" aria-hidden>
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-sm',
                      p.level === 'extreme'
                        ? 'bg-bad'
                        : p.level === 'unusual'
                          ? 'bg-risk'
                          : 'bg-[var(--series-ac)] opacity-60'
                    )}
                    style={{ width: pct(p.costPerValue) }}
                  />
                  {report.peerMedian !== null && (
                    <span
                      className="absolute -inset-y-0.5 w-px bg-ink"
                      style={{ left: pct(report.peerMedian) }}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'num text-right font-semibold',
                    p.level ? 'text-risk' : 'text-ink-2'
                  )}
                >
                  {formatIndex(p.costPerValue)}
                </span>
              </li>
            ))}
          </ul>
        </figure>
      )}

      {report.anomalies.length > 0 && (
        <ol className="mt-4 space-y-3 border-t border-rule pt-4">
          {report.anomalies.map((a) => (
            <li key={`${a.kind}-${a.itemId}`}>
              <div className="flex flex-wrap items-center gap-2">
                <AnomalyTag level={a.level} />
                <button
                  type="button"
                  onClick={() => open(a.itemId)}
                  className="text-left text-body font-semibold text-ink hover:text-ink-3 hover:underline"
                >
                  {a.taskName}
                </button>
              </div>
              <p className="mt-0.5 text-small text-ink-2">
                <span className="font-semibold text-ink">{ANOMALY_KIND_LABEL[a.kind]}.</span>{' '}
                {a.explanation}
              </p>
              {a.score !== null && (
                <p className="math mt-0.5 text-caption text-ink-3">
                  M = {formatIndex(a.score)} (|M| ≥ {formatIndex(ANOMALY_RULES.unusualAbove, 1)}{' '}
                  unusual, ≥ {formatIndex(ANOMALY_RULES.extremeAbove, 1)} extreme)
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 border-t border-rule pt-3 text-caption text-ink-3">
        Method: robust modified z-score,{' '}
        <span className="math">M = 0.6745 × (ln x − median) ÷ MAD</span>, over the {report.scored}{' '}
        package{report.scored === 1 ? '' : 's'} with both progress and cost. Median and MAD are not
        pulled by the outlier itself, which matters for small projects. It runs on this device; no
        data leaves it.
      </p>
    </Panel>
  )
}
