import { describe, it, expect } from 'vitest'
import { sanitizeFormulaInjection, workPackageSchema } from './validators'

describe('Formula-Injection Sanitization and Work Package Validation', () => {
  it('strips leading formula injection prefixes (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeFormulaInjection('=SUM(A1:A10)')).toEqual({
      sanitized: 'SUM(A1:A10)',
      wasModified: true
    })

    expect(sanitizeFormulaInjection('+cmd|/c calc')).toEqual({
      sanitized: 'cmd|/c calc',
      wasModified: true
    })

    expect(sanitizeFormulaInjection('-12345')).toEqual({
      sanitized: '12345',
      wasModified: true
    })

    expect(sanitizeFormulaInjection('@macro()')).toEqual({
      sanitized: 'macro()',
      wasModified: true
    })

    expect(sanitizeFormulaInjection('\t=DANGEROUS')).toEqual({
      sanitized: 'DANGEROUS',
      wasModified: true
    })

    expect(sanitizeFormulaInjection('Safe Normal Task Name')).toEqual({
      sanitized: 'Safe Normal Task Name',
      wasModified: false
    })
  })

  it('validates and transforms workPackageSchema correctly', () => {
    const raw = {
      taskName: '=Live Runtime Error Listener',
      category: '+Core Engineering',
      bac: '10000',
      plannedPercent: '50',
      actualPercent: '40',
      actualCost: '5000',
      notes: '@benchmark note'
    }

    const parsed = workPackageSchema.parse(raw)

    expect(parsed.taskName).toBe('Live Runtime Error Listener')
    expect(parsed.category).toBe('Core Engineering')
    expect(parsed.bac).toBe(10000)
    expect(parsed.plannedPercent).toBe(50)
    expect(parsed.actualPercent).toBe(40)
    expect(parsed.actualCost).toBe(5000)
    expect(parsed.notes).toBe('benchmark note')
  })

  it('rejects invalid inputs such as negative numbers or percentage > 100', () => {
    expect(() =>
      workPackageSchema.parse({
        taskName: 'Invalid Item',
        category: 'Test',
        bac: -100,
        plannedPercent: 50,
        actualPercent: 40,
        actualCost: 5000
      })
    ).toThrow()

    expect(() =>
      workPackageSchema.parse({
        taskName: 'Invalid Item',
        category: 'Test',
        bac: 1000,
        plannedPercent: 150,
        actualPercent: 40,
        actualCost: 5000
      })
    ).toThrow()
  })
})

describe('formula injection hidden behind whitespace', () => {
  it('still strips a prefix that follows leading spaces', () => {
    expect(sanitizeFormulaInjection('   =SUM(A1)')).toEqual({
      sanitized: 'SUM(A1)',
      wasModified: true
    })
    expect(sanitizeFormulaInjection(' \t@cmd')).toEqual({ sanitized: 'cmd', wasModified: true })
  })

  it('does not report plain leading spaces as an injection', () => {
    expect(sanitizeFormulaInjection('  Normal name ')).toEqual({
      sanitized: 'Normal name',
      wasModified: false
    })
  })
})
