import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEnrichedItems } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { ChartPanel, MiniTable } from '../ui/panel'
import { TooltipCard } from './ChartTooltip'
import { AXIS_TICK, SERIES } from './theme'
import { formatCompactCurrency, formatCurrency, formatIndex, truncate } from '../../lib/utils'

/** BAC, PV, EV and AC per package on one money axis. */
export const PackagePerformanceChart: React.FC = () => {
  const rows = useEnrichedItems()
  const currency = useAppStore((s) => s.currency)

  const data = useMemo(
    () =>
      rows.map(({ item, metrics }) => ({
        id: item.id,
        name: truncate(item.taskName, 24),
        fullName: item.taskName,
        BAC: metrics.bac,
        PV: metrics.pv,
        EV: metrics.ev,
        AC: metrics.ac,
        cpi: metrics.cpi,
        spi: metrics.spi
      })),
    [rows]
  )

  const height = Math.max(240, data.length * 64 + 40)

  return (
    <ChartPanel
      title="Budget, plan, earned and spent"
      subtitle="Per work package. Earned value (EV) behind plan (PV) means schedule slip; actual cost (AC) above EV means overrun."
      legend={[
        { label: 'Budget (BAC)', color: SERIES.bac, shape: 'track' },
        { label: 'Planned value (PV)', color: SERIES.pv },
        { label: 'Earned value (EV)', color: SERIES.ev },
        { label: 'Actual cost (AC)', color: SERIES.ac }
      ]}
      height={height}
      table={
        <MiniTable
          head={['Work package', 'BAC', 'PV', 'EV', 'AC']}
          align={['left', 'right', 'right', 'right', 'right']}
          rows={data.map((d) => [
            d.fullName,
            formatCurrency(d.BAC, currency),
            formatCurrency(d.PV, currency),
            formatCurrency(d.EV, currency),
            formatCurrency(d.AC, currency)
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
          barCategoryGap="22%"
          barGap={2}
        >
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            tick={{ ...AXIS_TICK, fill: 'var(--ink-2)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--subtle)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <TooltipCard
                  title={d.fullName}
                  rows={[
                    {
                      label: 'Budget (BAC)',
                      value: formatCurrency(d.BAC, currency),
                      color: SERIES.bac
                    },
                    {
                      label: 'Planned (PV)',
                      value: formatCurrency(d.PV, currency),
                      color: SERIES.pv
                    },
                    {
                      label: 'Earned (EV)',
                      value: formatCurrency(d.EV, currency),
                      color: SERIES.ev
                    },
                    { label: 'Spent (AC)', value: formatCurrency(d.AC, currency), color: SERIES.ac }
                  ]}
                  footer={`CPI ${formatIndex(d.cpi)} · SPI ${formatIndex(d.spi)}`}
                />
              )
            }}
          />
          <Bar
            dataKey="BAC"
            fill={SERIES.bac}
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            isAnimationActive={false}
          />
          <Bar
            dataKey="PV"
            fill={SERIES.pv}
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            isAnimationActive={false}
          />
          <Bar
            dataKey="EV"
            fill={SERIES.ev}
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            isAnimationActive={false}
          />
          <Bar
            dataKey="AC"
            fill={SERIES.ac}
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
