import React, { useMemo } from 'react'
import { useEnrichedItems } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { ChartPanel, MiniTable } from '../ui/panel'
import { TooltipCard } from './ChartTooltip'
import { SERIES } from './theme'
import { niceScale } from '../../lib/chartScale'
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatSignedCurrency,
  truncate
} from '../../lib/utils'

/**
 * Forecast cost (EAC) against budget (BAC) per package, all on one shared scale.
 * The ink tick is the budget line; anything past it is overrun.
 */
export const ForecastBullets: React.FC = () => {
  const rows = useEnrichedItems()
  const currency = useAppStore((s) => s.currency)
  const setInspectedItem = useAppStore((s) => s.setInspectedItem)

  const data = useMemo(() => [...rows].sort((a, b) => a.metrics.vac - b.metrics.vac), [rows])
  const { max, ticks } = niceScale(
    Math.max(0, ...data.map((r) => Math.max(r.metrics.bac, r.metrics.eac)))
  )
  const pct = (v: number): string => `${Math.min(100, Math.max(0, (v / max) * 100))}%`

  return (
    <ChartPanel
      title="Forecast against budget"
      subtitle="Estimate at completion (EAC = BAC ÷ CPI) per package. The tick marks the budget; red runs past it."
      legend={[
        { label: 'Budget (BAC)', color: SERIES.bac, shape: 'track' },
        { label: 'Forecast within budget', color: SERIES.fav },
        { label: 'Forecast over budget', color: SERIES.unfav }
      ]}
      height={Math.max(200, data.length * 44 + 36)}
      table={
        <MiniTable
          head={['Work package', 'BAC', 'EAC', 'VAC']}
          align={['left', 'right', 'right', 'right']}
          rows={data.map(({ item, metrics }) => [
            item.taskName,
            formatCurrency(metrics.bac, currency),
            formatCurrency(metrics.eac, currency),
            formatSignedCurrency(metrics.vac, currency)
          ])}
        />
      }
    >
      <div className="flex h-full flex-col">
        <ul className="flex flex-1 flex-col justify-around">
          {data.map(({ item, metrics }) => {
            const over = metrics.eac > metrics.bac + 0.005
            return (
              <li
                key={item.id}
                className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[168px_1fr_118px] sm:gap-3"
              >
                <button
                  type="button"
                  onClick={() => setInspectedItem(item)}
                  className="truncate text-left text-small text-ink-2 hover:text-ink-3 hover:underline"
                  title={item.taskName}
                >
                  {truncate(item.taskName, 26)}
                </button>
                <div
                  className="relative col-span-2 row-start-2 h-5 outline-none sm:col-span-1 sm:row-start-auto"
                  tabIndex={0}
                  aria-label={`${item.taskName}: budget ${formatCurrency(metrics.bac, currency)}, forecast ${formatCurrency(metrics.eac, currency)}`}
                >
                  {ticks.map((t) => (
                    <span
                      key={t}
                      className="absolute inset-y-0 w-px bg-[var(--grid)]"
                      style={{ left: pct(t) }}
                      aria-hidden
                    />
                  ))}
                  <span
                    className="absolute inset-y-0.5 left-0 rounded-r-[4px]"
                    style={{ width: pct(metrics.bac), background: SERIES.bac }}
                    aria-hidden
                  />
                  <span
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                    style={{
                      width: pct(metrics.eac),
                      background: over ? SERIES.unfav : SERIES.fav
                    }}
                    aria-hidden
                  />
                  <span
                    className="absolute -inset-y-0.5 w-0.5 rounded-full bg-ink"
                    style={{ left: `calc(${pct(metrics.bac)} - 1px)` }}
                    aria-hidden
                  />
                  <div className="invisible absolute bottom-full right-0 z-10 mb-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <TooltipCard
                      title={item.taskName}
                      rows={[
                        {
                          label: 'Budget (BAC)',
                          value: formatCurrency(metrics.bac, currency),
                          color: SERIES.bac
                        },
                        {
                          label: 'Forecast (EAC)',
                          value: formatCurrency(metrics.eac, currency),
                          color: over ? SERIES.unfav : SERIES.fav,
                          emphasis: true
                        },
                        {
                          label: 'Still to spend (ETC)',
                          value: formatCurrency(metrics.etc, currency)
                        },
                        {
                          label: 'Variance (VAC)',
                          value: formatSignedCurrency(metrics.vac, currency)
                        }
                      ]}
                    />
                  </div>
                </div>
                <div className="num col-start-2 row-start-1 text-right text-small sm:col-start-auto sm:row-start-auto">
                  <span className="font-semibold text-ink">
                    {formatCompactCurrency(metrics.eac, currency)}
                  </span>{' '}
                  <span className={cn(over ? 'font-mono text-bad' : 'text-ink-3')}>
                    {over ? formatSignedCurrency(metrics.vac, currency) : 'in budget'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <div
          className="grid grid-cols-[minmax(0,1fr)] gap-3 pt-1 sm:grid-cols-[168px_1fr_118px]"
          aria-hidden
        >
          <span className="max-sm:hidden" />
          <div className="relative h-4">
            {ticks.map((t, i) => (
              <span
                key={t}
                className={cn(
                  'num absolute text-caption text-ink-3',
                  i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
                )}
                style={{ left: pct(t) }}
              >
                {formatCompactCurrency(t, currency)}
              </span>
            ))}
          </div>
          <span className="max-sm:hidden" />
        </div>
      </div>
    </ChartPanel>
  )
}
