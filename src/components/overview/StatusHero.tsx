import React from 'react'
import { ArrowRight, FileText, GitCompareArrows } from 'lucide-react'
import { useProjectSummary, useSuggestions } from '../../hooks/useEvm'
import { useAppStore } from '../../store/useAppStore'
import { healthOf } from '../../lib/calculations'
import { countBySeverity } from '../../lib/suggestions'
import { HealthBadge } from '../ui/status'
import { Button } from '../ui/button'
import { verdictSentence } from '../worked/solutions'
import { cn, formatCurrency, formatPercent, formatSignedCurrency } from '../../lib/utils'

/** Progress against plan and spend, on one track: earned, the plan marker, and spend. */
const ProgressTrack: React.FC<{ planned: number; earned: number; spentShare: number }> = ({
  planned,
  earned,
  spentShare
}) => {
  const clamp = (v: number): number => Math.max(0, Math.min(100, v))
  return (
    <div className="space-y-2">
      <div className="relative h-1.5 rounded-full bg-subtle-2" aria-hidden>
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--series-ev)]"
          style={{ width: `${clamp(earned)}%` }}
        />
        <span
          className="absolute -inset-y-1 w-0.5 rounded-full bg-ink"
          style={{ left: `calc(${clamp(planned)}% - 1px)` }}
        />
      </div>
      <div className="relative h-1.5 rounded-full bg-subtle-2" aria-hidden>
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            spentShare > earned ? 'bg-[var(--series-ac)]' : 'bg-[var(--series-pv)]'
          )}
          style={{ width: `${clamp(spentShare)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * The overview's first viewport: the verdict as a headline, and a floating
 * forecast card over a soft backdrop, in the spirit of a product hero.
 */
export const StatusHero: React.FC = () => {
  const summary = useProjectSummary()
  const suggestions = useSuggestions()
  const currency = useAppStore((s) => s.currency)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const { level } = healthOf(summary.cpi, summary.spi)
  const { headline, forecast } = verdictSentence(summary, currency)
  const counts = countBySeverity(suggestions)
  const urgent = counts.critical + counts.warning
  const spentShare = summary.bac > 0 ? (summary.ac / summary.bac) * 100 : 0

  return (
    <section
      aria-labelledby="status-headline"
      className="card relative grid overflow-hidden min-[1180px]:grid-cols-[minmax(0,1fr)_420px]"
    >
      <div className="relative z-10 flex flex-col justify-between gap-6 p-5 sm:p-7">
        <div>
          <HealthBadge level={level} size="md" />
          <h2
            id="status-headline"
            className="mt-4 max-w-[22ch] font-display text-h1 font-semibold tracking-tight text-ink sm:text-hero"
          >
            {headline}
          </h2>
          <p className="mt-3 max-w-[56ch] text-ui text-ink-2">
            {forecast} {formatPercent(summary.actualPercent)} of the work is done against{' '}
            {formatPercent(summary.plannedPercent)} planned, and {formatPercent(spentShare)} of the
            budget is spent.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setActiveTab('actions')}>
            {urgent > 0
              ? `Review ${urgent} urgent action${urgent === 1 ? '' : 's'}`
              : 'Review actions'}
            <ArrowRight aria-hidden />
          </Button>
          <Button onClick={() => setActiveTab('reports')}>
            <FileText aria-hidden />
            Open report
          </Button>
        </div>
      </div>

      {/* Soft abstract backdrop, the product's equivalent of the reference's photo tiles */}
      {/* Below 1180px the forecast card stacks under the verdict instead of floating beside it. */}
      <div className="relative p-3 sm:p-6 min-[1180px]:min-h-[260px] min-[1180px]:p-0">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute -inset-10 opacity-90 blur-2xl"
            style={{
              background:
                'radial-gradient(40% 50% at 30% 30%, var(--aura-1), transparent 70%), radial-gradient(45% 55% at 75% 70%, var(--aura-2), transparent 70%), radial-gradient(35% 45% at 80% 20%, var(--aura-3), transparent 70%)'
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent 0 22px, rgb(255 255 255 / 0.18) 22px 23px)'
            }}
          />
        </div>

        <div className="relative flex items-center min-[1180px]:absolute min-[1180px]:inset-6">
          <div className="w-full rounded-xl border border-rule bg-paper/95 p-4 shadow-lift backdrop-blur sm:p-5">
            <div className="flex items-center gap-2 text-small text-ink-3">
              <GitCompareArrows className="size-4 text-good" aria-hidden />
              <span className="font-medium text-good">Forecast</span>
              <span>· at current efficiency</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="font-display text-figure font-semibold tracking-tight text-ink">
                {formatCurrency(summary.eac, currency)}
              </div>
              <div className="diff flex gap-2">
                <span className={summary.vac >= 0 ? 'text-good' : 'text-bad'}>
                  {formatSignedCurrency(summary.vac, currency)}
                </span>
                <span className="text-ink-3">vs {formatCurrency(summary.bac, currency)}</span>
              </div>
            </div>
            <div className="mt-4">
              <ProgressTrack
                planned={summary.plannedPercent}
                earned={summary.actualPercent}
                spentShare={spentShare}
              />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-caption">
              <div>
                <dt className="text-ink-3">Earned</dt>
                <dd className="num font-medium text-ink">{formatPercent(summary.actualPercent)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Planned</dt>
                <dd className="num font-medium text-ink">
                  {formatPercent(summary.plannedPercent)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Spent</dt>
                <dd className="num font-medium text-ink">{formatPercent(spentShare)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
