import { calculateEvmMetrics } from './calculations'

export interface ExportableItem {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes?: string | null
}

const HEADERS = [
  'Module Name',
  'Category',
  'Budget at Completion (BAC)',
  'Planned % Complete',
  'Actual % Complete',
  'Actual Cost (AC)',
  'Planned Value (PV)',
  'Earned Value (EV)',
  'Cost Variance (CV)',
  'Schedule Variance (SV)',
  'CPI',
  'SPI',
  'Estimate at Completion (EAC)',
  'Estimate to Complete (ETC)',
  'Variance at Completion (VAC)',
  'TCPI',
  'Cost Variance % (CV/EV)',
  'Schedule Variance % (SV/PV)',
  'Variance at Completion % (VAC/Budget)', // not "…BAC)": the importer reads a header ending in BAC as the budget
  'Notes'
]

/**
 * Quotes a text cell for CSV and neutralises spreadsheet formulas: a cell that
 * starts with = + - @ (after optional whitespace) gets a leading apostrophe so
 * Excel and Sheets show it as text instead of executing it.
 */
export function csvTextCell(value: string): string {
  const safe = /^\s*[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

function csvNumberCell(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return ''
  return String(Number(value.toFixed(decimals)))
}

/** A percentage variance, or an empty cell when its base is 0. */
const percentCell = (value: number | null): string =>
  value === null ? '' : csvNumberCell(value, 2)

/**
 * Builds a CSV of every work package with its full EVM breakdown. The first six
 * columns use the import template's headers, so the file imports back in.
 */
export function buildWorkPackagesCsv(items: ExportableItem[]): string {
  const rows = items.map((item) => {
    const m = calculateEvmMetrics(item)
    return [
      csvTextCell(item.taskName),
      csvTextCell(item.category),
      csvNumberCell(m.bac),
      csvNumberCell(m.plannedPercent),
      csvNumberCell(m.actualPercent),
      csvNumberCell(m.ac),
      csvNumberCell(m.pv),
      csvNumberCell(m.ev),
      csvNumberCell(m.cv),
      csvNumberCell(m.sv),
      csvNumberCell(m.cpi, 4),
      csvNumberCell(m.spi, 4),
      csvNumberCell(m.eac),
      csvNumberCell(m.etc),
      csvNumberCell(m.vac),
      Number.isFinite(m.tcpi) ? csvNumberCell(m.tcpi, 4) : csvTextCell('budget exhausted'),
      percentCell(m.cvPercent),
      percentCell(m.svPercent),
      percentCell(m.vacPercent),
      csvTextCell(item.notes ?? '')
    ].join(',')
  })
  return [HEADERS.map(csvTextCell).join(','), ...rows].join('\r\n')
}

/** Triggers a browser download of text content. */
export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'project'
  )
}
