import React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tone, TONE_TEXT } from './status'

/** A variable in a formula, set in italic serif. */
export function V({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <var>{children}</var>
}

interface WorkedSolutionProps {
  /** Plain-language name, e.g. "Cost performance index". */
  name: string
  /** The formula, e.g. <><V>CPI</V> = <V>EV</V> ÷ <V>AC</V></> */
  formula: React.ReactNode
  /** The same formula with the real numbers substituted. */
  substitution: React.ReactNode
  /** The result, highlighted like a student's answer. */
  answer: string
  /** One plain sentence on what the answer means. */
  verdict: string
  tone: Tone
  size?: 'md' | 'sm'
  className?: string
}

const TONE_ICON: Record<Tone, typeof Minus> = {
  good: ArrowUpRight,
  bad: ArrowDownRight,
  watch: ArrowDownRight,
  neutral: Minus
}

/**
 * The signature block: Given → Formula → Substitution → Answer.
 * The answer is the only highlighted thing on the screen.
 */
export function WorkedSolution({
  name,
  formula,
  substitution,
  answer,
  verdict,
  tone,
  size = 'md',
  className
}: WorkedSolutionProps): React.JSX.Element {
  const Icon = TONE_ICON[tone]
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div className="text-small font-semibold text-ink-2">{name}</div>
      <div className={cn('math mt-1.5 text-ink', 'text-body')}>{formula}</div>
      <div
        className="math mt-0.5 truncate text-body text-ink-3"
        title={typeof substitution === 'string' ? substitution : undefined}
      >
        {substitution}
      </div>
      <div className="mt-2">
        <span
          className={cn(
            'answer font-semibold tracking-tight text-ink',
            size === 'md' ? 'text-figure' : 'text-h2'
          )}
        >
          {answer}
        </span>
      </div>
      <div className={cn('mt-2 flex items-start gap-1 text-small font-medium', TONE_TEXT[tone])}>
        <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{verdict}</span>
      </div>
    </div>
  )
}
