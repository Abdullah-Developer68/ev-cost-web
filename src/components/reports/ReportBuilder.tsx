import React, { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import {
  useActiveProject,
  useAnomalies,
  useEnrichedItems,
  useProjectSummary,
  useSuggestions
} from '../../hooks/useEvm'
import { ANOMALY_KIND_LABEL, summarizeAnomalies } from '../../lib/anomalies'
import { AnomalyTag } from '../anomalies/UnusualSpendPanel'
import type { ReportSections } from '../../lib/pdfExport'
import { ALL_REPORT_SECTIONS, exportReportPdf } from '../../store/exportActions'
import { calculateEacScenarios, healthOf } from '../../lib/calculations'
import { Button } from '../ui/button'
import { HealthBadge, SeverityTag, toneOfIndex, toneOfMoney, TONE_TEXT } from '../ui/status'
import { buildSolutions, verdictSentence } from '../worked/solutions'
import {
  cn,
  formatCurrency,
  formatIndex,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent
} from '../../lib/utils'

const SECTION_LABELS: Record<keyof ReportSections, string> = {
  summary: 'Worked solution (12 metrics)',
  chart: 'Package chart',
  table: 'Work package breakdown',
  actions: 'Recommended actions',
  anomalies: 'Unusual spend (AI)',
  scenarios: 'Forecast range'
}

const H = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <h3 className="mb-3 border-b border-rule pb-1 font-display text-h3 font-semibold text-ink">
    {children}
  </h3>
)

export const ReportBuilder: React.FC = () => {
  const project = useActiveProject()
  const items = useCostStore((s) => s.items)
  const rows = useEnrichedItems()
  const summary = useProjectSummary()
  const suggestions = useSuggestions()
  const anomalies = useAnomalies()
  const currency = useAppStore((s) => s.currency)
  const [sections, setSections] = useState<ReportSections>(ALL_REPORT_SECTIONS)
  const [exporting, setExporting] = useState(false)

  const verdict = verdictSentence(summary, currency)
  const solutions = buildSolutions(summary, currency)
  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const maxValue = Math.max(1, ...rows.map((r) => Math.max(r.metrics.bac, r.metrics.ac)))
  const nothingSelected = !Object.values(sections).some(Boolean)

  const download = async (): Promise<void> => {
    setExporting(true)
    await exportReportPdf(sections)
    setExporting(false)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[1300px]:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4 min-[1300px]:sticky min-[1300px]:top-0">
        <div className="card p-5">
          <h2 className="font-display text-h2 font-semibold text-ink">Report</h2>
          <p className="mt-1 text-small text-ink-3">
            Choose the sections, check the preview, then download.
          </p>
          <fieldset className="mt-4 space-y-2">
            <legend className="label-caps mb-2">Sections</legend>
            {(Object.keys(SECTION_LABELS) as Array<keyof ReportSections>).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 text-body text-ink"
              >
                <input
                  type="checkbox"
                  checked={sections[key]}
                  onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))}
                  className="size-4 rounded-sm accent-[var(--spot)]"
                />
                {SECTION_LABELS[key]}
              </label>
            ))}
          </fieldset>
          <Button
            variant="primary"
            className="mt-5 w-full"
            onClick={download}
            loading={exporting}
            disabled={!project || nothingSelected}
          >
            <FileDown aria-hidden />
            Download PDF
          </Button>
          {nothingSelected && (
            <p className="mt-2 text-caption text-bad">Select at least one section.</p>
          )}
        </div>
      </aside>

      <article
        className="mx-auto w-full max-w-[1000px] overflow-hidden rounded-xl border border-rule bg-paper shadow-lift max-sm:[&_table]:block max-sm:[&_table]:overflow-x-auto"
        aria-label="Report preview"
      >
        <header className="border-b border-rule bg-sunken px-4 py-5 sm:px-8 sm:py-6">
          <h2 className="font-display text-h1 font-semibold">{project?.name}</h2>
          <p className="num mt-1 text-small text-ink-3">
            Earned value report · {today} · {items.length} work packages · Currency{' '}
            {currency.trim()}
          </p>
        </header>

        <div className="space-y-8 px-4 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center gap-3">
            <HealthBadge level={healthOf(summary.cpi, summary.spi).level} size="md" />
            <p className="font-display text-h3 text-ink">
              <span className="font-semibold">{verdict.headline}</span> {verdict.forecast}
            </p>
          </div>

          {sections.summary && (
            <section>
              <H>Worked solution: all 12 EVM metrics and the percentage variances</H>
              <table className="w-full border-collapse text-body">
                <tbody>
                  {[
                    [
                      'BAC',
                      'Budget at completion',
                      'sum of budgets',
                      formatCurrency(summary.bac, currency)
                    ],
                    [
                      'PV',
                      'Planned value',
                      `${formatPercent(summary.plannedPercent)} × BAC`,
                      formatCurrency(summary.pv, currency)
                    ],
                    [
                      'EV',
                      'Earned value',
                      `${formatPercent(summary.actualPercent)} × BAC`,
                      formatCurrency(summary.ev, currency)
                    ],
                    ['AC', 'Actual cost', 'spent to date', formatCurrency(summary.ac, currency)]
                  ].map(([sym, name, work, value]) => (
                    <tr key={sym} className="border-b border-rule">
                      <th className="math w-16 py-1.5 text-left font-semibold italic text-ink-3">
                        {sym}
                      </th>
                      <td className="py-1.5 text-ink-2">{name}</td>
                      <td className="math whitespace-nowrap py-1.5 pr-3 text-small text-ink-3">
                        {work}
                      </td>
                      <td className="num py-1.5 text-right font-semibold">{value}</td>
                      <td className="py-1.5 pl-6 text-small text-ink-3">Given</td>
                    </tr>
                  ))}
                  {solutions.map((s) => (
                    <tr key={s.key} className="border-b border-rule last:border-0">
                      <th className="math w-16 py-1.5 text-left font-semibold italic text-ink-3">
                        {s.key.toUpperCase()}
                      </th>
                      <td className="math py-1.5 text-ink">{s.formula}</td>
                      <td className="math whitespace-nowrap py-1.5 pr-3 text-small text-ink-3">
                        {s.substitution}
                      </td>
                      <td className="num py-1.5 text-right font-semibold">
                        <span className="answer">{s.answer}</span>
                      </td>
                      <td className={cn('py-1.5 pl-6 text-small', TONE_TEXT[s.tone])}>
                        {s.verdict}
                      </td>
                    </tr>
                  ))}
                  {(
                    [
                      ['CV%', 'CV ÷ EV × 100', summary.cvPercent],
                      ['SV%', 'SV ÷ PV × 100', summary.svPercent],
                      ['VAC%', 'VAC ÷ BAC × 100', summary.vacPercent]
                    ] as const
                  ).map(([sym, formula, value]) => (
                    <tr key={sym} className="border-b border-rule last:border-0">
                      <th className="math w-16 py-1.5 text-left font-semibold italic text-ink-3">
                        {sym}
                      </th>
                      <td className="math py-1.5 text-ink">{formula}</td>
                      <td className="py-1.5 pr-3" />
                      <td className="num py-1.5 text-right font-semibold">
                        <span className="answer">{formatSignedPercent(value)}</span>
                      </td>
                      <td
                        className={cn(
                          'py-1.5 pl-6 text-small',
                          TONE_TEXT[value === null ? 'neutral' : toneOfMoney(value)]
                        )}
                      >
                        Percentage variance
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {sections.chart && (
            <section>
              <H>Budget, plan, earned and spent by work package</H>
              <ul className="mb-3 flex flex-wrap gap-4 text-small text-ink-2">
                {[
                  ['Budget (BAC)', 'var(--series-bac)'],
                  ['Planned value (PV)', 'var(--series-pv)'],
                  ['Earned value (EV)', 'var(--series-ev)'],
                  ['Actual cost (AC)', 'var(--series-ac)']
                ].map(([label, color]) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{ background: color }}
                      aria-hidden
                    />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="space-y-2.5">
                {rows.map(({ item, metrics: m }) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,104px)_1fr] items-center gap-3 sm:grid-cols-[200px_1fr]"
                  >
                    <span className="truncate text-small text-ink-2" title={item.taskName}>
                      {item.taskName}
                    </span>
                    <div className="relative py-0.5">
                      <span
                        className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[var(--series-bac)]"
                        style={{ width: `${(m.bac / maxValue) * 100}%` }}
                        aria-hidden
                      />
                      {(['pv', 'ev', 'ac'] as const).map((k) => (
                        <span
                          key={k}
                          className="relative my-0.5 block h-1.5 rounded-r-[3px]"
                          style={{
                            width: `${(m[k] / maxValue) * 100}%`,
                            background: `var(--series-${k})`
                          }}
                          title={`${k.toUpperCase()} ${formatCurrency(m[k], currency)}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sections.table && (
            <section>
              <H>Work package breakdown</H>
              <table className="w-full border-collapse text-small">
                <thead>
                  <tr className="border-b border-rule text-ink-3">
                    {[
                      'Work package',
                      'BAC',
                      'EV',
                      'AC',
                      'CV',
                      'CV%',
                      'CPI',
                      'SPI',
                      'EAC',
                      'VAC'
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn('py-1.5 font-semibold', i === 0 ? 'text-left' : 'text-right')}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, metrics: m }) => (
                    <tr key={item.id} className="border-b border-rule">
                      <td className="max-w-[260px] truncate py-1.5 pr-3 font-semibold text-ink">
                        {item.taskName}
                      </td>
                      <td className="num py-1.5 text-right">{formatCurrency(m.bac, currency)}</td>
                      <td className="num py-1.5 text-right">{formatCurrency(m.ev, currency)}</td>
                      <td className="num py-1.5 text-right">{formatCurrency(m.ac, currency)}</td>
                      <td
                        className={cn(
                          'num py-1.5 text-right font-semibold',
                          TONE_TEXT[toneOfMoney(m.cv)]
                        )}
                      >
                        {formatSignedCurrency(m.cv, currency)}
                      </td>
                      <td className={cn('num py-1.5 text-right', TONE_TEXT[toneOfMoney(m.cv)])}>
                        {formatSignedPercent(m.cvPercent)}
                      </td>
                      <td
                        className={cn(
                          'num py-1.5 text-right font-semibold',
                          TONE_TEXT[toneOfIndex(m.cpi)]
                        )}
                      >
                        {formatIndex(m.cpi)}
                      </td>
                      <td
                        className={cn(
                          'num py-1.5 text-right font-semibold',
                          TONE_TEXT[toneOfIndex(m.spi)]
                        )}
                      >
                        {formatIndex(m.spi)}
                      </td>
                      <td className="num py-1.5 text-right">{formatCurrency(m.eac, currency)}</td>
                      <td
                        className={cn(
                          'num py-1.5 text-right font-semibold',
                          TONE_TEXT[toneOfMoney(m.vac)]
                        )}
                      >
                        {formatSignedCurrency(m.vac, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {sections.actions && (
            <section>
              <H>Recommended actions</H>
              <ol className="space-y-3">
                {suggestions.map((s, i) => (
                  <li key={s.id} className="grid grid-cols-[24px_1fr] gap-2">
                    <span className="math text-h3 font-bold text-ink-3">{i + 1}.</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityTag severity={s.severity} />
                        <span className="text-body font-semibold text-ink">{s.title}</span>
                      </div>
                      <p className="mt-0.5 text-small text-ink-2">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {sections.anomalies && (
            <section>
              <H>Unusual spend (anomaly detection)</H>
              <p className="text-body text-ink-2">{summarizeAnomalies(anomalies, currency)}</p>
              {anomalies.anomalies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {anomalies.anomalies.map((a) => (
                    <li key={`${a.kind}-${a.itemId}`} className="flex flex-wrap items-start gap-2">
                      <AnomalyTag level={a.level} />
                      <div className="min-w-0 flex-1">
                        <span className="text-body font-semibold text-ink">{a.taskName}</span>
                        <span className="text-small text-ink-3">
                          {' '}
                          · {ANOMALY_KIND_LABEL[a.kind]}
                        </span>
                        <p className="text-small text-ink-2">{a.explanation}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {sections.scenarios && (
            <section>
              <H>Forecast range</H>
              <table className="w-full border-collapse text-small">
                <tbody>
                  {calculateEacScenarios(summary).map((sc) => (
                    <tr key={sc.id} className="border-b border-rule last:border-0">
                      <td className="py-1.5 pr-3 font-semibold text-ink">{sc.label}</td>
                      <td className="math py-1.5 pr-3 text-ink-2">EAC = {sc.formula}</td>
                      <td className="num py-1.5 text-right font-semibold">
                        {formatCurrency(sc.eac, currency)}
                      </td>
                      <td
                        className={cn(
                          'num w-28 py-1.5 text-right font-semibold',
                          sc.vac < -0.005 ? 'text-bad' : 'text-good'
                        )}
                      >
                        {formatSignedCurrency(sc.vac, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
        <footer className="border-t border-rule px-4 py-3 text-caption text-ink-3 sm:px-8">
          Generated by EV-COST. Formulas follow the standard earned value method.
        </footer>
      </article>
    </div>
  )
}
