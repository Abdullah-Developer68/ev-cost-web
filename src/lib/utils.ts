import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge must know the custom type scale; otherwise it reads `text-body`
 * as a colour and drops a real colour class such as `text-primary-fg`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['caption', 'small', 'body', 'ui', 'h3', 'h2', 'h1', 'figure', 'hero'] }
      ]
    }
  }
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Money with the project's currency symbol. Negative values use a true minus sign. */
export function formatCurrency(amount: number, currency = '$', decimals = 0): string {
  if (Number.isNaN(amount)) return '—'
  if (!Number.isFinite(amount)) return amount > 0 ? '∞' : '−∞'
  const rounded = Number(amount.toFixed(decimals))
  const isNegative = rounded < 0
  const absFormatted = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  return isNegative ? `−${currency}${absFormatted}` : `${currency}${absFormatted}`
}

/** Money with an explicit sign, for variances: +$1,250 / −$2,500 / $0. */
export function formatSignedCurrency(amount: number, currency = '$', decimals = 0): string {
  const base = formatCurrency(amount, currency, decimals)
  if (Number.isFinite(amount) && Number(amount.toFixed(decimals)) > 0) return `+${base}`
  return base
}

/** Short money for chart axes: $12.5k, $1.2M. */
export function formatCompactCurrency(amount: number, currency = '$'): string {
  if (!Number.isFinite(amount)) return '—'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${currency}${trimZeros((abs / 1_000_000).toFixed(1))}M`
  if (abs >= 1_000) return `${sign}${currency}${trimZeros((abs / 1_000).toFixed(1))}k`
  return `${sign}${currency}${Math.round(abs)}`
}

function trimZeros(text: string): string {
  return text.replace(/\.0$/, '')
}

export function formatPercent(percent: number, decimals = 1): string {
  if (!Number.isFinite(percent)) return '—'
  return `${percent.toFixed(decimals)}%`
}

/** Signed percentage for percentage variances: +12.5% / −20.0% / 0.0%. `null` renders as —. */
export function formatSignedPercent(percent: number | null, decimals = 1): string {
  if (percent === null || !Number.isFinite(percent)) return '—'
  const rounded = Number(percent.toFixed(decimals))
  if (rounded === 0) return `${(0).toFixed(decimals)}%`
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(decimals)}%`
}

/** Performance index (CPI, SPI, TCPI). Infinity renders as ∞, NaN as an em dash. */
export function formatIndex(val: number, decimals = 2): string {
  if (Number.isNaN(val)) return '—'
  if (!Number.isFinite(val)) return '∞'
  return val.toFixed(decimals)
}

/** Shortens long work package names for chart axes. */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
