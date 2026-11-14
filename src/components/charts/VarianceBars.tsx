import React, { useMemo } from 'react'
import { useEnrichedItems } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { ChartPanel, MiniTable } from '../ui/panel'
import { SERIES } from './theme'
import { niceScale } from '../../lib/chartScale'
import { cn, formatCompactCurrency, formatSignedCurrency, truncate } from '../../lib/utils'
import { useMediaQuery } from '../../platform/layout/useMediaQuery'

/**
 * Cost variance and schedule variance per package, read as a pair on one shared,
 * symmetric axis. Right of the centre line is favourable, left is unfavourable.
 */
export const VarianceBars: React.FC = () => {
  const rows = useEnrichedItems()
  const currency = useAppStore((s) => s.currency)
  const narrow = !useMediaQuery('(min-width: 640px)')

  const data = useMemo(() => [...rows].sort((a, b) => a.metrics.cv - b.metrics.cv), [rows])
  const { max, ticks } = niceScale(
    Math.max(0, ...data.flatMap((r) => [Math.abs(r.metrics.cv), Math.abs(r.metrics.sv)])),
    2
  )
  const axis = [
    ...ticks
      .slice(1)
      .reverse()
      .map((t) => -t),
    ...ticks
  ]
  const pos = (v: number): string => `${50 + (v / max) * 50}%`

  return (
    <ChartPanel
      title="Variance by package"
      subtitle="Cost variance (CV = EV − AC) and schedule variance (SV = EV − PV), on one shared scale."
      legend={[
        { label: 'Favourable (+)', color: SERIES.fav },
        { label: 'Unfavourable (−)', color: SERIES.unfav }
      ]}
      // Web: below 640px each name sits on its own line above its two bars.
      height={Math.max(200, data.length * (narrow ? 66 : 52) + 30)}
      table={
        <MiniTable
          head={['Work package', 'CV', 'SV']}
          align={['left', 'right', 'right']}
          rows={data.map(({ item, metrics }) => [
            item.taskName,
            formatSignedCurrency(metrics.cv, currency),
            formatSignedCurrency(metrics.sv, currency)
          ])}
        />
      }
    >
      <div className="flex h-full flex-col">
        <div className="relative flex-1">
          {/* gridlines and the zero line run behind every row */}
          <div
            className="pointer-events-none absolute inset-y-0 left-8 right-[84px] sm:left-[204px]"
            aria-hidden
          >
            {axis.map((t) => (
              <span
                key={t}
                className={cn(
                  'absolute inset-y-0 w-px',
                  t === 0 ? 'bg-rule-strong' : 'bg-[var(--grid)]'
                )}
                style={{ left: pos(t) }}
              />
            ))}
          </div>
          <ul className="relative flex h-full flex-col justify-around">
            {data.map(({ item, metrics }) => (
              <li
                key={item.id}
                className="grid grid-cols-[24px_1fr_76px] items-center gap-x-2 gap-y-1 sm:grid-cols-[164px_24px_1fr_76px]"
              >
                <span
                  className="col-span-3 truncate text-small text-ink-2 sm:col-span-1 sm:row-span-2"
                  title={item.taskName}
                >
                  {truncate(item.taskName, 26)}
                </span>
                {[
                  { key: 'CV', value: metrics.cv },
                  { key: 'SV', value: metrics.sv }
                ].map((cell) => {
                  const zero = Math.abs(cell.value) < 0.005
                  const positive = cell.value > 0
                  const width = (Math.abs(cell.value) / max) * 50
                  return (
                    <React.Fragment key={cell.key}>
                      <span className="math text-caption italic text-ink-3">{cell.key}</span>
                      <div
                        className="relative h-3"
                        role="img"
                        aria-label={`${item.taskName} ${cell.key} ${formatSignedCurrency(cell.value, currency)}`}
                      >
                        {!zero && (
                          <span
                            className={cn(
                              'absolute inset-y-0',
                              positive ? 'rounded-r-[4px]' : 'rounded-l-[4px]'
                            )}
                            style={{
                              left: positive ? '50%' : `${50 - width}%`,
                              width: `${width}%`,
                              background: positive ? SERIES.fav : SERIES.unfav
                            }}
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          'diff text-right',
                          zero ? 'text-ink-3' : positive ? 'text-good' : 'text-bad'
                        )}
                      >
                        {formatSignedCurrency(cell.value, currency)}
                      </span>
                    </React.Fragment>
                  )
                })}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative ml-8 mr-[84px] h-5 sm:ml-[204px]" aria-hidden>
          {axis.map((t, i) => (
            <span
              key={t}
              className={cn(
                'num absolute top-1 whitespace-nowrap text-caption text-ink-3',
                i === 0 ? '' : i === axis.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
              )}
              style={{ left: pos(t) }}
            >
              {t === 0 ? '0' : `${t > 0 ? '+' : ''}${formatCompactCurrency(t, currency)}`}
            </span>
          ))}
        </div>
      </div>
    </ChartPanel>
  )
}
