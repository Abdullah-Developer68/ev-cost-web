import React, { useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { useSuggestions } from '../../hooks/useEvm'
import { calculateEacScenarios, calculateEvmMetrics, healthOf } from '../../lib/calculations'
import { Drawer } from '../ui/overlay'
import { Button } from '../ui/button'
import { HealthBadge, SeverityTag } from '../ui/status'
import { V, WorkedSolution } from '../ui/worked'
import { buildSolutions } from '../worked/solutions'
import { TriggerChips } from '../overview/NextActionsPanel'
import { cn, formatCurrency, formatSignedCurrency } from '../../lib/utils'

const n = (v: number): string => v.toLocaleString('en-US', { maximumFractionDigits: 2 })

export const PackageDrawer: React.FC = () => {
  const inspected = useAppStore((s) => s.inspectedItem)
  const setInspectedItem = useAppStore((s) => s.setInspectedItem)
  const setEditingItem = useAppStore((s) => s.setEditingItem)
  const requestConfirm = useAppStore((s) => s.requestConfirm)
  const currency = useAppStore((s) => s.currency)
  const items = useCostStore((s) => s.items)
  const deleteItem = useCostStore((s) => s.deleteItem)
  const suggestions = useSuggestions()

  // Always read the live record so edits made elsewhere show here immediately.
  const item = inspected ? items.find((i) => i.id === inspected.id) : undefined
  const m = useMemo(() => (item ? calculateEvmMetrics(item) : null), [item])

  if (!inspected || !item || !m) return null

  const close = (): void => setInspectedItem(null)
  const solutions = buildSolutions(m, currency)
  const scenarios = calculateEacScenarios(m)
  const related = suggestions.filter((s) => s.itemId === item.id)
  const { level } = healthOf(m.cpi, m.spi)

  return (
    <Drawer
      title={item.taskName}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <HealthBadge level={level} />
          <span>{item.category}</span>
        </span>
      }
      onClose={close}
      actions={
        <div className="flex gap-1">
          <Button size="sm" onClick={() => setEditingItem(item)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            aria-label="Delete work package"
            onClick={() =>
              requestConfirm({
                title: 'Delete this work package?',
                body: `“${item.taskName}” will be removed from the project. You can undo this right after.`,
                confirmLabel: 'Delete',
                tone: 'danger',
                onConfirm: async () => {
                  close()
                  await deleteItem(item.id)
                }
              })
            }
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      }
    >
      <div className="space-y-6 px-4 py-5 sm:px-6">
        {item.notes && <p className="text-body text-ink-2">{item.notes}</p>}

        <section aria-labelledby="given-title">
          <h3 id="given-title" className="label-caps mb-2">
            Given
          </h3>
          <table className="w-full border-collapse text-body">
            <tbody className="math">
              {[
                { sym: 'BAC', label: 'Budget at completion', work: 'from the plan', value: m.bac },
                {
                  sym: 'PV',
                  label: 'Planned value',
                  work: `${n(m.plannedPercent)}% × ${n(m.bac)}`,
                  value: m.pv
                },
                {
                  sym: 'EV',
                  label: 'Earned value',
                  work: `${n(m.actualPercent)}% × ${n(m.bac)}`,
                  value: m.ev
                },
                { sym: 'AC', label: 'Actual cost', work: 'spent to date', value: m.ac }
              ].map((row) => (
                <tr key={row.sym} className="border-b border-rule last:border-0">
                  <th scope="row" className="w-16 py-2 text-left font-semibold">
                    <V>{row.sym}</V>
                  </th>
                  <td className="py-2 font-sans text-ink-3">{row.label}</td>
                  <td className="py-2 text-ink-2">{row.work}</td>
                  <td className="num py-2 text-right font-sans font-semibold text-ink">
                    {formatCurrency(row.value, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="solution-title">
          <h3 id="solution-title" className="label-caps mb-2">
            Worked solution
          </h3>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-rule">
            {solutions.map((s, i) => (
              <WorkedSolution
                key={s.key}
                size="sm"
                name={s.name}
                formula={s.formula}
                substitution={s.substitution}
                answer={s.answer}
                verdict={s.verdict}
                tone={s.tone}
                className={cn(
                  'px-4 py-3.5',
                  i % 2 === 1 && 'border-l border-rule',
                  i > 1 && 'border-t border-rule'
                )}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="actions-title">
          <h3 id="actions-title" className="label-caps mb-2">
            What to do
          </h3>
          {related.length === 0 ? (
            <p className="text-body text-ink-3">
              No action needed: this package is within every threshold.
            </p>
          ) : (
            <ul className="space-y-3">
              {related.map((s) => (
                <li key={s.id} className="rounded-lg border border-rule p-4">
                  <SeverityTag severity={s.severity} />
                  <div className="mt-1.5 text-ui font-semibold text-ink">{s.title}</div>
                  <p className="mt-1 text-body text-ink-2">{s.detail}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-body text-ink-2 marker:font-semibold marker:text-ink-3">
                    {s.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="mt-3">
                    <TriggerChips suggestion={s} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="scenarios-title">
          <h3 id="scenarios-title" className="label-caps mb-2">
            Forecast range
          </h3>
          <table className="w-full border-collapse text-body">
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-b border-rule last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-ink">{s.label}</div>
                    <div className="math text-small text-ink-3">EAC = {s.formula}</div>
                  </td>
                  <td className="num py-2 text-right font-semibold text-ink">
                    {formatCurrency(s.eac, currency)}
                  </td>
                  <td
                    className={cn(
                      'num w-28 py-2 text-right font-semibold',
                      s.vac < -0.005 ? 'text-bad' : 'text-good'
                    )}
                  >
                    {formatSignedCurrency(s.vac, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Drawer>
  )
}
