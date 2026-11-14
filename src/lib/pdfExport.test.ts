import { describe, it, expect } from 'vitest'
import { buildEvmReportPdf, pdfSafe } from './pdfExport'
import { calculateProjectEvmSummary } from './calculations'
import { generateSuggestions } from './suggestions'
import { detectSpendAnomalies } from './anomalies'
import type { WorkPackageItem } from '../types'

const item = (id: number, bac: number, p: number, a: number, ac: number): WorkPackageItem => ({
  id,
  projectId: 1,
  taskName: `Package ${id}`,
  category: id % 2 ? 'Core' : 'QA',
  bac,
  plannedPercent: p,
  actualPercent: a,
  actualCost: ac,
  notes: null,
  createdAt: null
})

describe('pdfSafe', () => {
  it('maps characters the PDF base font cannot draw', () => {
    expect(pdfSafe('−$2,500 · CPI ≥ 1.05 → ∞')).toBe('-$2,500 · CPI >= 1.05 -> n/a')
    expect(pdfSafe('₹1,000')).toBe('Rs 1,000')
    expect(pdfSafe('€ £ ¥ “quoted”')).toBe('€ £ ¥ “quoted”')
    expect(pdfSafe('line one\nline two')).toBe('line one\nline two')
  })
})

describe('buildEvmReportPdf', () => {
  const items = [
    item(1, 10000, 50, 40, 5000),
    item(2, 15000, 75, 80, 11000),
    item(3, 6000, 40, 30, 3500),
    item(4, 1000, 80, 60, 1200) // budget exhausted: TCPI is infinite
  ]
  const options = {
    projectName: 'Demo Project',
    description: 'Synthetic test data',
    currency: '€',
    summary: calculateProjectEvmSummary(items),
    items,
    suggestions: generateSuggestions(items, '€'),
    anomalies: detectSpendAnomalies(items, '€'),
    sections: {
      summary: true,
      chart: true,
      table: true,
      actions: true,
      anomalies: true,
      scenarios: true
    }
  }

  it('builds every section without throwing, including infinite TCPI', () => {
    const doc = buildEvmReportPdf(options)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    const raw = doc.output()
    expect(raw).toContain('Worked solution')
    expect(raw).toContain('Recommended actions')
    expect(raw).toContain('Forecast range')
    expect(raw).toContain('Unusual spend')
    expect(raw).toContain('Cost variance %')
    expect(raw).toContain('Page 1 of')
  })

  it('omits sections that were switched off', () => {
    const doc = buildEvmReportPdf({
      ...options,
      sections: {
        summary: true,
        chart: false,
        table: false,
        actions: false,
        anomalies: false,
        scenarios: false
      }
    })
    const raw = doc.output()
    expect(raw).toContain('Worked solution')
    expect(raw).not.toContain('Recommended actions')
    expect(raw).not.toContain('Work package breakdown')
    expect(raw).not.toContain('Unusual spend')
  })
})
