import React, { useId, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RotateCcw } from 'lucide-react'
import { useProjectSummary } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { Legend, Panel } from '../ui/panel'
import { Button } from '../ui/button'
import { V } from '../ui/worked'
import { SERIES } from '../charts/theme'
import { niceScale } from '../../lib/chartScale'
import {
  budgetChangeToBreakEven,
  clampBudgetChange,
  clampFutureCpi,
  formatFutureCpi,
  simulateForecast,
  WHAT_IF_LIMITS,
  WhatIfResult
} from '../../lib/whatIf'
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatIndex,
  formatSignedCurrency
} from '../../lib/utils'

const fmt = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 }).replace('-', '−')

interface SliderProps {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  display: React.ReactNode
  valueText: string
  onChange: (value: number) => void
  presets: Array<{ label: string; value: number }>
}

/** A labelled range slider with one-click presets under it. */
const Slider: React.FC<SliderProps> = ({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  valueText,
  onChange,
  presets
}) => {
  const id = useId()
  const hintId = useId()
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small font-semibold text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-ui font-semibold text-ink">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="slider mt-1.5"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        aria-describedby={hintId}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => {
          const active = Math.abs(preset.value - value) < step / 2
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(preset.value)}
              className={cn(
                'h-7 rounded-full border px-2.5 text-caption font-medium transition-colors duration-150',
                active
                  ? 'border-ink bg-subtle-2 text-ink'
                  : 'border-rule-strong bg-paper text-ink-2 hover:bg-subtle hover:text-ink'
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      <p id={hintId} className="mt-1.5 text-caption text-ink-3">
        {hint}
      </p>
    </div>
  )
}

interface BulletProps {
  label: string
  eac: number
  budget: number
  max: number
  currency: string
}

/** One forecast against its budget, in the same marks as the per-package bullet chart. */
const Bullet: React.FC<BulletProps> = ({ label, eac, budget, max, currency }) => {
  const pct = (v: number): string => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const vac = budget - eac
  const over = vac < -0.005
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[92px_1fr_124px] sm:gap-3">
      <span className="text-small text-ink-2">{label}</span>
      <div
        className="relative col-span-2 row-start-2 h-5 sm:col-span-1 sm:row-start-auto"
        role="img"
        aria-label={`${label}: forecast ${formatCurrency(eac, currency)} against a budget of ${formatCurrency(budget, currency)}`}
      >
        <span
          className="absolute inset-y-0.5 left-0 rounded-r-sm"
          style={{ width: pct(budget), background: SERIES.bac }}
        />
        <span
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-r-sm transition-[width] duration-200 ease-out"
          style={{ width: pct(eac), background: over ? SERIES.unfav : SERIES.fav }}
        />
        <span
          className="absolute -inset-y-0.5 w-0.5 rounded-full bg-ink transition-[left] duration-200 ease-out"
          style={{ left: `calc(${pct(budget)} - 1px)` }}
        />
      </div>
      <div className="num col-start-2 row-start-1 whitespace-nowrap text-right text-small sm:col-start-auto sm:row-start-auto">
        <span className="font-semibold text-ink">{formatCompactCurrency(eac, currency)}</span>{' '}
        <span className={cn('font-mono', over ? 'text-bad' : 'text-good')}>
          {formatSignedCurrency(vac, currency)}
        </span>
      </div>
    </li>
  )
}

function verdict(result: WhatIfResult, currency: string): { text: string; tone: string } {
  const amount = formatCurrency(Math.abs(result.vac), currency)
  const budget = formatCurrency(result.budget, currency)
  if (result.outcome === 'under') {
    return { text: `Finishes ${amount} under the ${budget} budget.`, tone: 'text-good' }
  }
  if (result.outcome === 'on') {
    return { text: `Finishes on the ${budget} budget.`, tone: 'text-good' }
  }
  const need = Number.isFinite(result.breakEvenCpi)
    ? `Landing on budget needs an efficiency of ${formatIndex(result.breakEvenCpi)} from now on.`
    : 'The budget is already spent, so no efficiency recovers it: add budget or cut scope.'
  return { text: `Finishes ${amount} over the ${budget} budget. ${need}`, tone: 'text-bad' }
}

/**
 * Lets the user test a recovery plan against the forecast: change how efficient
 * the remaining work is, or how much budget there is, and see where the project
 * would finish. Nothing here is saved or changes the project's data.
 */
export const WhatIfPanel: React.FC = () => {
  const summary = useProjectSummary()
  const currency = useAppStore((s) => s.currency)
  const totals = useMemo(
    () => ({ bac: summary.bac, ev: summary.ev, ac: summary.ac }),
    [summary.bac, summary.ev, summary.ac]
  )

  const currentCpi = clampFutureCpi(summary.cpi)
  // null means "follow the project's current CPI", so the default tracks the data.
  const [chosenCpi, setChosenCpi] = useState<number | null>(null)
  const [chosenBudgetChange, setChosenBudgetChange] = useState(0)

  const futureCpi = chosenCpi ?? currentCpi
  const budgetChange = clampBudgetChange(chosenBudgetChange, totals.bac)
  const pristine = (chosenCpi === null || chosenCpi === currentCpi) && budgetChange === 0

  // The project's own forecast, so this row always agrees with the rest of the app.
  const trend = { eac: summary.eac, budget: totals.bac }
  const plan = simulateForecast(totals, { futureCpi, budgetChange })
  const saving = trend.eac - plan.eac
  const { text, tone } = verdict(plan, currency)
  const Icon =
    plan.outcome === 'over' ? ArrowDownRight : plan.outcome === 'under' ? ArrowUpRight : Minus

  const budgetStep = Math.max(1, Math.round(totals.bac * WHAT_IF_LIMITS.stepBudgetShare))
  const budgetMin = Math.round(totals.bac * WHAT_IF_LIMITS.minBudgetShare)
  const budgetMax = Math.round(totals.bac * WHAT_IF_LIMITS.maxBudgetShare)
  const cover = clampBudgetChange(
    Math.max(0, budgetChangeToBreakEven(totals, futureCpi)),
    totals.bac
  )

  const cpiPresets = [
    { label: `Current ${formatIndex(currentCpi)}`, value: currentCpi },
    { label: 'On plan 1.00', value: 1 }
  ]
  const breakEven = simulateForecast(totals, { futureCpi: 1, budgetChange }).breakEvenCpi
  if (
    Number.isFinite(breakEven) &&
    breakEven >= WHAT_IF_LIMITS.minCpi &&
    breakEven <= WHAT_IF_LIMITS.maxCpi &&
    Math.abs(breakEven - 1) > 0.005 &&
    Math.abs(breakEven - currentCpi) > 0.005
  ) {
    cpiPresets.push({
      label: `Break-even ${formatIndex(breakEven)}`,
      value: clampFutureCpi(breakEven)
    })
  }

  const budgetPresets = [{ label: 'No change', value: 0 }]
  if (cover > 0) {
    budgetPresets.push({
      label: `Cover the overrun ${formatSignedCurrency(cover, currency)}`,
      value: cover
    })
  }

  const { max } = niceScale(Math.max(trend.eac, plan.eac, trend.budget, plan.budget))

  return (
    <Panel
      title="What if?"
      subtitle="Test a recovery plan before you commit to it. Nothing here changes your data."
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={pristine}
          onClick={() => {
            setChosenCpi(null)
            setChosenBudgetChange(0)
          }}
        >
          <RotateCcw aria-hidden />
          Reset
        </Button>
      }
    >
      <div className="space-y-5">
        <Slider
          label="Cost efficiency from now on"
          hint={`The CPI you expect for the work still to do. 1.00 means every ${currency}1 spent earns ${currency}1 of work.`}
          value={futureCpi}
          min={WHAT_IF_LIMITS.minCpi}
          max={WHAT_IF_LIMITS.maxCpi}
          step={WHAT_IF_LIMITS.stepCpi}
          display={formatIndex(futureCpi)}
          valueText={`CPI ${formatIndex(futureCpi)}`}
          onChange={(value) => setChosenCpi(clampFutureCpi(value))}
          presets={cpiPresets}
        />
        <Slider
          label="Budget change"
          hint="Extra budget you could get approved, or budget you expect to lose."
          value={budgetChange}
          min={budgetMin}
          max={budgetMax}
          step={budgetStep}
          display={
            <span className={cn(budgetChange > 0 && 'text-good', budgetChange < 0 && 'text-bad')}>
              {formatSignedCurrency(budgetChange, currency)}
            </span>
          }
          valueText={formatSignedCurrency(budgetChange, currency)}
          onChange={(value) => setChosenBudgetChange(clampBudgetChange(value, totals.bac))}
          presets={budgetPresets}
        />
      </div>

      <div className="mt-5 border-t border-rule pt-4" aria-live="polite">
        <div className="math text-body text-ink">
          <V>EAC</V> = <V>AC</V> + (<V>BAC</V> − <V>EV</V>) ÷ <V>CPI</V>
        </div>
        <div className="math mt-0.5 text-body text-ink-3">
          = {fmt(totals.ac)} + {fmt(plan.remainingWork)} ÷ {formatFutureCpi(futureCpi)}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="answer text-figure font-semibold tracking-tight text-ink">
            {formatCurrency(plan.eac, currency)}
          </span>
          <span className="diff flex gap-2">
            <span className={plan.vac < -0.005 ? 'text-bad' : 'text-good'}>
              {formatSignedCurrency(plan.vac, currency)}
            </span>
            <span className="text-ink-3">vs {formatCurrency(plan.budget, currency)}</span>
          </span>
        </div>
        <p className={cn('mt-2 flex items-start gap-1 text-small font-medium', tone)}>
          <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{text}</span>
        </p>
        {Math.abs(saving) > 0.5 && (
          <p className="mt-1 text-small text-ink-2">
            That is {formatCurrency(Math.abs(saving), currency)} {saving > 0 ? 'less' : 'more'} than
            the current trend of {formatCurrency(trend.eac, currency)}.
          </p>
        )}
      </div>

      <ul className="mt-4 space-y-1.5">
        <Bullet
          label="Current trend"
          eac={trend.eac}
          budget={trend.budget}
          max={max}
          currency={currency}
        />
        <Bullet
          label="This plan"
          eac={plan.eac}
          budget={plan.budget}
          max={max}
          currency={currency}
        />
      </ul>
      <div className="mt-3">
        <Legend
          entries={[
            { label: 'Budget', color: SERIES.bac, shape: 'track' },
            { label: 'Forecast within budget', color: SERIES.fav },
            { label: 'Forecast over budget', color: SERIES.unfav }
          ]}
        />
      </div>
    </Panel>
  )
}
