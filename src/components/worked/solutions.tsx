import React from 'react'
import type { EvmMetrics } from '../../lib/calculations'
import {
  formatCurrency,
  formatIndex,
  formatSignedCurrency,
  formatSignedPercent
} from '../../lib/utils'
import { toneOfIndex, toneOfMoney, type Tone } from '../ui/status'
import { V } from '../ui/worked'

export interface SolutionSpec {
  key: 'cv' | 'sv' | 'cpi' | 'spi' | 'eac' | 'etc' | 'vac' | 'tcpi'
  name: string
  formula: React.ReactNode
  substitution: string
  answer: string
  verdict: string
  tone: Tone
}

/** Plain number for substitutions: textbook style, grouped, no currency symbol. */
const n = (value: number, decimals = 0): string =>
  Number.isFinite(value)
    ? value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : '∞'

/** A negative operand is wrapped in parentheses, as on paper. */
const operand = (value: number, decimals = 0): string =>
  value < 0 ? `(${n(value, decimals)})` : n(value, decimals)

/** Appends the percentage variance, e.g. "… (−25.0% of EV)". Omitted when the base is 0. */
const withPercent = (verdict: string, percent: number | null, base: string): string =>
  percent === null ? verdict : `${verdict} (${formatSignedPercent(percent)} of ${base})`

export function buildSolutions(m: EvmMetrics, currency: string): SolutionSpec[] {
  const money = (v: number): string => formatCurrency(v, currency)
  const perDollar = `${currency}1`

  const cvVerdict =
    toneOfMoney(m.cv) === 'neutral'
      ? 'Exactly on budget so far'
      : m.cv > 0
        ? `Work is worth ${money(m.cv)} more than it cost`
        : `Spent ${money(-m.cv)} more than the work is worth`

  const svVerdict =
    toneOfMoney(m.sv) === 'neutral'
      ? 'Exactly on schedule'
      : m.sv > 0
        ? `${money(m.sv)} of work done ahead of plan`
        : `${money(-m.sv)} of planned work not yet done`

  const eacUsesAtypical = !(m.cpi > 0)

  let tcpiVerdict: string
  let tcpiTone: Tone
  if (!Number.isFinite(m.tcpi)) {
    tcpiVerdict = 'Budget is spent; finishing within BAC is impossible'
    tcpiTone = 'bad'
  } else if (m.tcpi === 0) {
    tcpiVerdict = 'All work is complete'
    tcpiTone = 'neutral'
  } else if (m.tcpi > 1 + 1e-6) {
    tcpiVerdict = `Must earn ${currency}${formatIndex(m.tcpi)} per ${perDollar} from now on`
    tcpiTone = m.tcpi - m.cpi > 0.1 ? 'bad' : 'watch'
  } else {
    tcpiVerdict = `Only ${currency}${formatIndex(m.tcpi)} per ${perDollar} needed to stay in budget`
    tcpiTone = 'good'
  }

  return [
    {
      key: 'cv',
      name: 'Cost variance',
      formula: (
        <>
          <V>CV</V> = <V>EV</V> − <V>AC</V>
        </>
      ),
      substitution: `= ${n(m.ev)} − ${n(m.ac)}`,
      answer: formatSignedCurrency(m.cv, currency),
      verdict: withPercent(cvVerdict, m.cvPercent, 'EV'),
      tone: toneOfMoney(m.cv)
    },
    {
      key: 'sv',
      name: 'Schedule variance',
      formula: (
        <>
          <V>SV</V> = <V>EV</V> − <V>PV</V>
        </>
      ),
      substitution: `= ${n(m.ev)} − ${n(m.pv)}`,
      answer: formatSignedCurrency(m.sv, currency),
      verdict: withPercent(svVerdict, m.svPercent, 'PV'),
      tone: toneOfMoney(m.sv)
    },
    {
      key: 'cpi',
      name: 'Cost performance index',
      formula: (
        <>
          <V>CPI</V> = <V>EV</V> ÷ <V>AC</V>
        </>
      ),
      substitution: m.ac > 0 ? `= ${n(m.ev)} ÷ ${n(m.ac)}` : 'No cost recorded: taken as 1.00',
      answer: formatIndex(m.cpi),
      verdict: `Earns ${currency}${formatIndex(m.cpi)} of value per ${perDollar} spent`,
      tone: toneOfIndex(m.cpi)
    },
    {
      key: 'spi',
      name: 'Schedule performance index',
      formula: (
        <>
          <V>SPI</V> = <V>EV</V> ÷ <V>PV</V>
        </>
      ),
      substitution: m.pv > 0 ? `= ${n(m.ev)} ÷ ${n(m.pv)}` : 'Nothing planned yet: taken as 1.00',
      answer: formatIndex(m.spi),
      verdict: `Working at ${formatIndex(m.spi * 100, 0)}% of the planned pace`,
      tone: toneOfIndex(m.spi)
    },
    {
      key: 'eac',
      name: 'Estimate at completion',
      formula: eacUsesAtypical ? (
        <>
          <V>EAC</V> = <V>AC</V> + (<V>BAC</V> − <V>EV</V>)
        </>
      ) : (
        <>
          <V>EAC</V> = <V>BAC</V> ÷ <V>CPI</V>
        </>
      ),
      substitution: eacUsesAtypical
        ? `= ${n(m.ac)} + (${n(m.bac)} − ${n(m.ev)})`
        : `= ${n(m.bac)} ÷ ${n(m.cpi, 3)}`,
      answer: money(m.eac),
      verdict: eacUsesAtypical
        ? 'CPI is 0, so the budgeted rate is assumed for the rest'
        : 'Forecast total cost at the current efficiency',
      tone: toneOfMoney(m.bac - m.eac)
    },
    {
      key: 'etc',
      name: 'Estimate to complete',
      formula: (
        <>
          <V>ETC</V> = <V>EAC</V> − <V>AC</V>
        </>
      ),
      substitution: `= ${n(m.eac)} − ${n(m.ac)}`,
      answer: money(m.etc),
      verdict: m.etc > 0 ? 'Still needed to finish the remaining work' : 'Nothing left to spend',
      tone: 'neutral'
    },
    {
      key: 'vac',
      name: 'Variance at completion',
      formula: (
        <>
          <V>VAC</V> = <V>BAC</V> − <V>EAC</V>
        </>
      ),
      substitution: `= ${n(m.bac)} − ${operand(m.eac)}`,
      answer: formatSignedCurrency(m.vac, currency),
      verdict: withPercent(
        toneOfMoney(m.vac) === 'neutral'
          ? 'Forecast to land exactly on budget'
          : m.vac > 0
            ? `Forecast to finish ${money(m.vac)} under budget`
            : `Forecast to finish ${money(-m.vac)} over budget`,
        m.vacPercent,
        'BAC'
      ),
      tone: toneOfMoney(m.vac)
    },
    {
      key: 'tcpi',
      name: 'To-complete performance index',
      formula: (
        <>
          <V>TCPI</V> = (<V>BAC</V> − <V>EV</V>) ÷ (<V>BAC</V> − <V>AC</V>)
        </>
      ),
      substitution: `= ${n(m.bac - m.ev)} ÷ ${operand(m.bac - m.ac)}`,
      answer: formatIndex(m.tcpi),
      verdict: tcpiVerdict,
      tone: tcpiTone
    }
  ]
}

/** One-sentence project verdict, health first. */
export function verdictSentence(
  m: EvmMetrics,
  currency: string
): { headline: string; forecast: string } {
  const cost =
    toneOfIndex(m.cpi) === 'neutral' ? 'On budget' : m.cpi > 1 ? 'Under budget' : 'Over budget'
  const schedule =
    toneOfIndex(m.spi) === 'neutral'
      ? 'on schedule'
      : m.spi > 1
        ? 'ahead of schedule'
        : 'behind schedule'
  const joiner = m.cpi >= 1 === m.spi >= 1 ? 'and' : 'but'
  const forecast =
    toneOfMoney(m.vac) === 'neutral'
      ? 'Forecast to finish on budget.'
      : m.vac > 0
        ? `Forecast to finish ${formatCurrency(m.vac, currency)} under budget.`
        : `Forecast to finish ${formatCurrency(-m.vac, currency)} over budget.`
  return { headline: `${cost} ${joiner} ${schedule}.`, forecast }
}
