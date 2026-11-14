import React, { useMemo } from 'react'
import {
  CartesianGrid,
  Label,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts'
import { useEnrichedItems } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { ChartPanel, MiniTable } from '../ui/panel'
import { HEALTH_META } from '../ui/status'
import { TooltipCard } from './ChartTooltip'
import { AXIS_TICK } from './theme'
import { formatCurrency, formatIndex, truncate } from '../../lib/utils'

/** Domain always includes 1.0 with clean 0.1 / 0.2 tick steps around the data. */
function niceAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter(Number.isFinite)
  const lo = Math.min(0.8, ...finite)
  const hi = Math.max(1.2, ...finite)
  const step = hi - lo > 1 ? 0.2 : 0.1
  const start = Math.floor((lo - 0.05) / step) * step
  const end = Math.ceil((hi + 0.05) / step) * step
  const ticks: number[] = []
  for (let t = start; t <= end + 1e-9; t += step) ticks.push(Number(t.toFixed(2)))
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks }
}

/**
 * Each package plotted by schedule (SPI, x) and cost (CPI, y) efficiency; dot area is its
 * budget. The lower-left quadrant (behind and over budget) is where trouble lives.
 */
export const PerformanceMap: React.FC = () => {
  const rows = useEnrichedItems()
  const currency = useAppStore((s) => s.currency)
  const setInspectedItem = useAppStore((s) => s.setInspectedItem)

  const data = useMemo(
    () =>
      rows
        .filter(({ metrics }) => metrics.ev > 0 || metrics.ac > 0)
        .map(({ item, metrics, health }) => ({
          item,
          name: truncate(item.taskName, 18),
          fullName: item.taskName,
          spi: Number(metrics.spi.toFixed(3)),
          cpi: Number(metrics.cpi.toFixed(3)),
          bac: metrics.bac,
          health
        })),
    [rows]
  )

  const xAxis = niceAxis(data.map((d) => d.spi))
  const yAxis = niceAxis(data.map((d) => d.cpi))
  const xDomain = xAxis.domain
  const yDomain = yAxis.domain
  const labelAll = data.length <= 8

  return (
    <ChartPanel
      title="Performance map"
      subtitle="Cost efficiency (CPI) against schedule efficiency (SPI). Dot size is the package budget. Click a dot to inspect it."
      height={300}
      table={
        <MiniTable
          head={['Work package', 'SPI', 'CPI', 'BAC', 'Health']}
          align={['left', 'right', 'right', 'right', 'left']}
          rows={data.map((d) => [
            d.fullName,
            formatIndex(d.spi),
            formatIndex(d.cpi),
            formatCurrency(d.bac, currency),
            HEALTH_META[d.health].label
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 24, bottom: 22, left: 4 }}>
          <ReferenceArea
            x1={xDomain[0]}
            x2={1}
            y1={yDomain[0]}
            y2={1}
            fill="var(--bad-bg)"
            fillOpacity={0.7}
            ifOverflow="hidden"
          />
          <ReferenceArea
            x1={1}
            x2={xDomain[1]}
            y1={1}
            y2={yDomain[1]}
            fill="var(--good-bg)"
            fillOpacity={0.6}
            ifOverflow="hidden"
          />
          <CartesianGrid stroke="var(--grid)" />
          <XAxis
            type="number"
            dataKey="spi"
            domain={xDomain}
            ticks={xAxis.ticks}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tickFormatter={(v: number) => v.toFixed(1)}
          >
            <Label
              value="SPI: schedule efficiency →"
              position="insideBottom"
              offset={-14}
              style={{ fontSize: 12, fill: 'var(--ink-3)' }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="cpi"
            domain={yDomain}
            ticks={yAxis.ticks}
            width={52}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(1)}
          >
            <Label
              value="CPI: cost efficiency →"
              angle={-90}
              position="insideLeft"
              offset={2}
              style={{ fontSize: 12, fill: 'var(--ink-3)', textAnchor: 'middle' }}
            />
          </YAxis>
          <ZAxis type="number" dataKey="bac" range={[90, 720]} />
          <ReferenceLine x={1} stroke="var(--rule-strong)" />
          <ReferenceLine y={1} stroke="var(--rule-strong)" />
          <ReferenceLine
            x={xDomain[1]}
            stroke="none"
            label={{
              value: 'Ahead · under budget',
              position: 'insideTopRight',
              fill: 'var(--good)',
              fontSize: 12,
              fontWeight: 600
            }}
          />
          <ReferenceLine
            x={xDomain[0]}
            stroke="none"
            label={{
              value: 'Behind · over budget',
              position: 'insideBottomLeft',
              fill: 'var(--bad)',
              fontSize: 12,
              fontWeight: 600
            }}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <TooltipCard
                  title={d.fullName}
                  rows={[
                    { label: 'SPI (schedule)', value: formatIndex(d.spi), emphasis: true },
                    { label: 'CPI (cost)', value: formatIndex(d.cpi), emphasis: true },
                    { label: 'Budget', value: formatCurrency(d.bac, currency) },
                    { label: 'Health', value: HEALTH_META[d.health].label }
                  ]}
                  footer="Click to see the worked solution"
                />
              )
            }}
          />
          <Scatter
            data={data}
            fill="var(--spot)"
            fillOpacity={0.82}
            stroke="var(--paper)"
            strokeWidth={2}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(point: { payload?: (typeof data)[number] }) =>
              point.payload && setInspectedItem(point.payload.item)
            }
          >
            {labelAll && (
              <LabelList
                dataKey="name"
                position="right"
                offset={10}
                style={{ fontSize: 12, fill: 'var(--ink-2)', pointerEvents: 'none' }}
              />
            )}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
