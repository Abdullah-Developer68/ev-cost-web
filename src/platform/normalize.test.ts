import { describe, it, expect } from 'vitest'
import {
  assertId,
  normalizeCurrency,
  normalizeProject,
  normalizeWorkPackage,
  sanitizeInputString
} from './normalize'

describe('main-process input normalisation', () => {
  it('strips formula-injection prefixes and caps length', () => {
    expect(sanitizeInputString('=cmd|calc')).toBe('cmd|calc')
    expect(sanitizeInputString('  -@+value ')).toBe('value')
    expect(sanitizeInputString(null)).toBe('')
    expect(sanitizeInputString('x'.repeat(400))).toHaveLength(255)
  })

  it('clamps percentages and rejects negative or non-numeric money', () => {
    const n = normalizeWorkPackage({
      taskName: '',
      category: '',
      bac: -10,
      plannedPercent: 150,
      actualPercent: Number.NaN,
      actualCost: 'abc' as unknown as number
    })
    expect(n).toEqual({
      taskName: 'Untitled Work Package',
      category: 'General',
      bac: 0,
      plannedPercent: 100,
      actualPercent: 0,
      actualCost: 0,
      notes: ''
    })
  })

  it('accepts numeric strings from the renderer', () => {
    const n = normalizeWorkPackage({
      taskName: 'API',
      category: 'Core',
      bac: '1000' as unknown as number,
      plannedPercent: 50,
      actualPercent: 40,
      actualCost: 500
    })
    expect(n.bac).toBe(1000)
  })

  it('only accepts short currency symbols', () => {
    expect(normalizeCurrency('€')).toBe('€')
    expect(normalizeCurrency('PKR ')).toBe('PKR ')
    expect(normalizeCurrency('<script>')).toBe('$')
    expect(normalizeCurrency(undefined)).toBe('$')
  })

  it('normalises projects', () => {
    expect(normalizeProject({ name: '  =Q1 ', currency: '£' })).toEqual({
      name: 'Q1',
      description: '',
      currency: '£'
    })
  })

  it('rejects ids that are not positive integers', () => {
    expect(assertId(4)).toBe(4)
    expect(assertId('7')).toBe(7)
    expect(() => assertId(0)).toThrow()
    expect(() => assertId(1.5)).toThrow()
    expect(() => assertId('abc')).toThrow()
  })
})
