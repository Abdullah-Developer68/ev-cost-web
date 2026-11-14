import React from 'react'
import { useProjectSummary } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { healthOf } from '../../lib/calculations'
import { Panel } from '../ui/panel'
import { HealthBadge, toneOfIndex, toneOfMoney, TONE_TEXT } from '../ui/status'
import { cn, formatCurrency, formatIndex, formatSignedCurrency } from '../../lib/utils'

/** Roll-up by category: which part of the project is driving the variance. */
export const CategorySummary: React.FC = () => {
  const summary = useProjectSummary()
  const currency = useAppStore((s) => s.currency)
  if (summary.categories.length < 2) return null

  const rows = [...summary.categories].sort((a, b) => a.vac - b.vac)
  const th = 'border-b border-rule px-3 py-2 text-small font-semibold text-ink-3'
  const td = 'num border-b border-rule px-3 py-2.5 text-right'

  return (
    <Panel
      title="By category"
      subtitle="Each category's totals, worst forecast first. Indices come from summed values, not averages."
      bodyClassName="overflow-x-auto overscroll-x-contain px-0 pb-1"
    >
      <table className="w-full border-separate border-spacing-0 text-body">
        <thead>
          <tr>
            <th
              className={cn(
                th,
                'pl-5 text-left',
                'sticky left-0 z-[1] bg-paper shadow-[1px_0_0_var(--rule)] min-[1400px]:shadow-none'
              )}
            >
              Category
            </th>
            <th className={cn(th, 'text-left')}>Health</th>
            <th className={cn(th, 'text-right')}>Packages</th>
            <th className={cn(th, 'text-right')}>BAC</th>
            <th className={cn(th, 'text-right')}>EV</th>
            <th className={cn(th, 'text-right')}>AC</th>
            <th className={cn(th, 'text-right')}>CPI</th>
            <th className={cn(th, 'text-right')}>SPI</th>
            <th className={cn(th, 'text-right')}>EAC</th>
            <th className={cn(th, 'pr-5 text-right')}>VAC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.category}>
              <th
                scope="row"
                className="sticky left-0 z-[1] bg-paper shadow-[1px_0_0_var(--rule)] min-[1400px]:shadow-none whitespace-nowrap border-b border-rule py-2.5 pl-5 pr-3 text-left font-semibold text-ink"
              >
                {c.category}
              </th>
              <td className="border-b border-rule px-3 py-2.5">
                <HealthBadge level={healthOf(c.cpi, c.spi).level} />
              </td>
              <td className={td}>{c.itemCount}</td>
              <td className={td}>{formatCurrency(c.bac, currency)}</td>
              <td className={td}>{formatCurrency(c.ev, currency)}</td>
              <td className={td}>{formatCurrency(c.ac, currency)}</td>
              <td className={cn(td, 'font-semibold', TONE_TEXT[toneOfIndex(c.cpi)])}>
                {formatIndex(c.cpi)}
              </td>
              <td className={cn(td, 'font-semibold', TONE_TEXT[toneOfIndex(c.spi)])}>
                {formatIndex(c.spi)}
              </td>
              <td className={td}>{formatCurrency(c.eac, currency)}</td>
              <td className={cn(td, 'pr-5 font-mono font-medium', TONE_TEXT[toneOfMoney(c.vac)])}>
                {formatSignedCurrency(c.vac, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
