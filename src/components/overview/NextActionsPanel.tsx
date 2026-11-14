import React from 'react'
import { ArrowRight } from 'lucide-react'
import { useSuggestions } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { SeverityTag } from '../ui/status'
import { Button } from '../ui/button'
import type { Suggestion } from '../../lib/suggestions'

/** One ranked action; shared by the overview column and the full actions page. */
export const ActionTitle: React.FC<{ suggestion: Suggestion; className?: string }> = ({
  suggestion,
  className
}) => {
  const items = useCostStore((s) => s.items)
  const setInspectedItem = useAppStore((s) => s.setInspectedItem)
  const item = suggestion.itemId ? items.find((i) => i.id === suggestion.itemId) : undefined

  if (!item) return <span className={className}>{suggestion.title}</span>
  return (
    <button
      type="button"
      onClick={() => setInspectedItem(item)}
      className={`text-left decoration-rule-strong underline-offset-2 hover:text-ink-3 hover:underline ${className ?? ''}`}
      title="Open the work package"
    >
      {suggestion.title}
    </button>
  )
}

/** "CPI 0.51 < 0.80": the measured value read straight into the rule it broke. */
function chipText(metric: string, value: string, rule: string): { lead: string; rest: string } {
  const prefix = new RegExp(`^(?:Project |Donor |Receiver )?${metric} `)
  if (prefix.test(rule)) return { lead: `${metric} ${value}`, rest: rule.replace(prefix, '') }
  return { lead: `${metric} ${value}`, rest: `· ${rule}` }
}

export const TriggerChips: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => {
  if (suggestion.triggers.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Why this was suggested">
      {suggestion.triggers.map((t, i) => {
        const { rest } = chipText(t.metric, t.value, t.rule)
        return (
          <li
            key={`${t.metric}-${i}`}
            className="math inline-flex items-baseline gap-1 rounded-sm border border-rule bg-plane px-1.5 py-0.5 text-caption text-ink-2"
            title={`Rule: ${t.rule}`}
          >
            <var className="text-ink">{t.metric}</var>
            <span className="font-semibold text-ink">{t.value}</span>
            <span className="text-ink-3">{rest}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** The margin column: the top few actions, ranked. */
export const NextActionsPanel: React.FC = () => {
  const suggestions = useSuggestions()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const top = suggestions.slice(0, 3)

  return (
    <section aria-labelledby="next-actions-title" className="flex flex-col card">
      <header className="flex items-baseline justify-between gap-3 border-b border-rule px-5 py-3">
        <h2 id="next-actions-title" className="font-display text-h2 font-semibold text-ink">
          What to do next
        </h2>
        <span className="num text-small text-ink-3">{suggestions.length} total</span>
      </header>
      <ol className="flex flex-col">
        {top.map((s, index) => (
          <li key={s.id} className="flex gap-3 border-b border-rule px-5 py-4 last:border-0">
            <span className="math w-4 shrink-0 text-h3 font-bold text-ink-3" aria-hidden>
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <ActionTitle
                suggestion={s}
                className="block text-ui font-semibold leading-snug text-ink"
              />
              <SeverityTag severity={s.severity} className="mt-1.5" />
              <p className="mt-1 line-clamp-3 text-small text-ink-2">{s.detail}</p>
              <div className="mt-2">
                <TriggerChips suggestion={s} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      {suggestions.length > top.length && (
        <div className="border-t border-rule px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('actions')}
            className="w-full justify-between"
          >
            See all {suggestions.length} actions and the rules behind them
            <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
    </section>
  )
}
