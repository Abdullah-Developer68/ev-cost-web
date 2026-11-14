import React from 'react'
import { AlertTriangle, CheckCircle2, Eye, Info, OctagonAlert, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HealthLevel } from '@/lib/calculations'
import type { SuggestionSeverity } from '@/lib/suggestions'

export const HEALTH_META: Record<
  HealthLevel,
  { label: string; icon: typeof CheckCircle2; text: string; bg: string; dot: string }
> = {
  healthy: {
    label: 'On track',
    icon: CheckCircle2,
    text: 'text-good',
    bg: 'bg-good-bg',
    dot: 'bg-good'
  },
  watch: { label: 'Watch', icon: Eye, text: 'text-watch', bg: 'bg-watch-bg', dot: 'bg-watch' },
  'at-risk': {
    label: 'At risk',
    icon: AlertTriangle,
    text: 'text-risk',
    bg: 'bg-risk-bg',
    dot: 'bg-risk'
  },
  critical: {
    label: 'Critical',
    icon: OctagonAlert,
    text: 'text-bad',
    bg: 'bg-bad-bg',
    dot: 'bg-bad'
  }
}

/** Health is always icon + word + colour, never colour alone. */
export function HealthBadge({
  level,
  size = 'sm',
  className
}: {
  level: HealthLevel
  size?: 'sm' | 'md'
  className?: string
}): React.JSX.Element {
  const meta = HEALTH_META[level]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm font-semibold',
        meta.text,
        meta.bg,
        size === 'sm' ? 'px-1.5 py-0.5 text-caption' : 'px-2 py-1 text-small',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      {meta.label}
    </span>
  )
}

export const SEVERITY_META: Record<
  SuggestionSeverity,
  { label: string; icon: typeof Info; text: string; bg: string }
> = {
  critical: { label: 'Critical', icon: OctagonAlert, text: 'text-bad', bg: 'bg-bad-bg' },
  warning: { label: 'Warning', icon: AlertTriangle, text: 'text-risk', bg: 'bg-risk-bg' },
  info: { label: 'Note', icon: Info, text: 'text-ink-3', bg: 'bg-subtle' },
  positive: { label: 'Good', icon: TrendingUp, text: 'text-good', bg: 'bg-good-bg' }
}

export function SeverityTag({
  severity,
  className
}: {
  severity: SuggestionSeverity
  className?: string
}): React.JSX.Element {
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption font-semibold',
        meta.text,
        meta.bg,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

export type Tone = 'good' | 'bad' | 'watch' | 'neutral'

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  watch: 'text-watch',
  neutral: 'text-ink-2'
}

/** Favourable / unfavourable from a signed money value. */
export function toneOfMoney(value: number): Tone {
  if (Math.abs(value) < 0.005) return 'neutral'
  return value > 0 ? 'good' : 'bad'
}

/** Favourable / unfavourable for an index where higher is better. */
export function toneOfIndex(value: number): Tone {
  if (Math.abs(value - 1) < 1e-6) return 'neutral'
  return value > 1 ? 'good' : 'bad'
}
