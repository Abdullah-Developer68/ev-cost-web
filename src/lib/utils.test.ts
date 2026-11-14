import { describe, it, expect } from 'vitest'
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatIndex,
  formatSignedCurrency,
  formatSignedPercent,
  truncate
} from './utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('px-2 py-1', 'bg-blue-500', { 'text-white': true, hidden: false })
    expect(result).toBe('px-2 py-1 bg-blue-500 text-white')
  })

  it('keeps a colour class next to a custom font-size class', () => {
    expect(cn('bg-primary text-primary-fg', 'h-9 px-4 text-body')).toBe(
      'bg-primary text-primary-fg h-9 px-4 text-body'
    )
    expect(cn('text-small', 'text-body')).toBe('text-body')
  })

  it('should resolve tailwind conflict classes', () => {
    const result = cn('px-2 py-1 p-4')
    expect(result).toBe('p-4')
  })
})

describe('formatters', () => {
  it('formats currency with a true minus sign and no negative zero', () => {
    expect(formatCurrency(12500)).toBe('$12,500')
    expect(formatCurrency(-2500)).toBe('−$2,500')
    expect(formatCurrency(-0.2)).toBe('$0')
    expect(formatCurrency(1234.5, '€', 2)).toBe('€1,234.50')
    expect(formatCurrency(NaN)).toBe('—')
  })

  it('signs variances', () => {
    expect(formatSignedCurrency(1250)).toBe('+$1,250')
    expect(formatSignedCurrency(-1000)).toBe('−$1,000')
    expect(formatSignedCurrency(0)).toBe('$0')
  })

  it('compacts axis values', () => {
    expect(formatCompactCurrency(12500)).toBe('$12.5k')
    expect(formatCompactCurrency(51000)).toBe('$51k')
    expect(formatCompactCurrency(-2000)).toBe('−$2k')
    expect(formatCompactCurrency(1_200_000, '£')).toBe('£1.2M')
    expect(formatCompactCurrency(450)).toBe('$450')
  })

  it('never hides an infinite index behind a normal-looking number', () => {
    expect(formatIndex(0.8)).toBe('0.80')
    expect(formatIndex(Infinity)).toBe('∞')
    expect(formatIndex(NaN)).toBe('—')
  })

  it('truncates long labels with an ellipsis', () => {
    expect(truncate('Short', 10)).toBe('Short')
    expect(truncate('A very long work package name', 12)).toBe('A very long…')
  })
})

describe('formatSignedPercent', () => {
  it('signs percentage variances with a true minus and renders null as a dash', () => {
    expect(formatSignedPercent(12.345)).toBe('+12.3%')
    expect(formatSignedPercent(-25)).toBe('−25.0%')
    expect(formatSignedPercent(0.01)).toBe('0.0%')
    expect(formatSignedPercent(null)).toBe('—')
    expect(formatSignedPercent(Infinity)).toBe('—')
  })
})
