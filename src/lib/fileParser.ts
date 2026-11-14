import Papa from 'papaparse'
import { ZodError } from 'zod'
import { workPackageSchema, sanitizeFormulaInjection } from './validators'

export interface ParsedWorkPackage {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes?: string
}

export interface ParseResult {
  items: ParsedWorkPackage[]
  errors: string[]
  sanitizedCount: number
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

type FieldKey =
  'taskName' | 'category' | 'notes' | 'actualCost' | 'bac' | 'plannedPercent' | 'actualPercent'

const isProgressWord = (k: string): boolean =>
  k.includes('percent') || k.includes('complete') || k.includes('progress') || k.includes('pct')

/**
 * Maps a spreadsheet header to a work-package field. Order matters: cost
 * columns are matched before percent columns because both start with "actual",
 * and budget before planned because "Planned Budget" is a BAC column.
 * Exported for tests.
 */
export function matchHeader(header: string): FieldKey | null {
  const k = normalizeHeader(header)
  if (!k) return null

  if (
    [
      'taskname',
      'task',
      'module',
      'modulename',
      'workpackage',
      'workpackagename',
      'name',
      'item',
      'activity',
      'deliverable'
    ].includes(k) ||
    ((k.startsWith('task') || k.startsWith('module') || k.startsWith('workpackage')) &&
      !k.includes('category') &&
      !k.includes('cost') &&
      !k.includes('budget'))
  )
    return 'taskName'
  if (
    ['category', 'group', 'type', 'dept', 'department', 'workstream', 'area', 'phase'].includes(k)
  )
    return 'category'
  if (['notes', 'note', 'comments', 'comment', 'description', 'remarks'].includes(k)) return 'notes'

  if (
    k === 'ac' ||
    k.includes('actualcost') ||
    k.includes('spent') ||
    k.includes('incurred') ||
    k.includes('actualexpense')
  )
    return 'actualCost'

  if (
    k === 'bac' ||
    k === 'budget' ||
    k.includes('budgetatcompletion') ||
    k.endsWith('bac') ||
    k.includes('plannedbudget') ||
    k.includes('totalbudget')
  )
    return 'bac'

  if (k === 'planned' || k === 'pvpercent' || (k.startsWith('planned') && isProgressWord(k)))
    return 'plannedPercent'

  if (
    k === 'actual' ||
    k === 'evpercent' ||
    k === 'percentcomplete' ||
    k === 'complete' ||
    k === 'progress' ||
    (k.startsWith('actual') && isProgressWord(k))
  )
    return 'actualPercent'

  return null
}

function parseNumber(val: unknown, isPercentCell = false): number {
  if (typeof val === 'number') return isPercentCell ? val * 100 : val
  const cleaned = String(val).replace(/[^0-9.-]+/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function mapRowToWorkPackage(
  row: Record<string, unknown>,
  rowIndex: number,
  sanitizationCounter: { count: number },
  percentHeaders: Set<string> = new Set()
): { item?: ParsedWorkPackage; error?: string } {
  let taskName = ''
  let category = 'General'
  let bac = 0
  let plannedPercent = 0
  let actualPercent = 0
  let actualCost = 0
  let notes = ''

  const sanitizeText = (value: string): string => {
    const sanitized = sanitizeFormulaInjection(value)
    if (sanitized.wasModified) sanitizationCounter.count++
    return sanitized.sanitized
  }

  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === null || val === '') continue
    const field = matchHeader(key)
    if (!field) continue
    const strVal = String(val).trim()
    const isPercentCell = percentHeaders.has(key)

    switch (field) {
      case 'taskName':
        taskName = sanitizeText(strVal)
        break
      case 'category':
        category = sanitizeText(strVal) || 'General'
        break
      case 'notes':
        notes = sanitizeText(strVal)
        break
      case 'bac':
        bac = parseNumber(val)
        break
      case 'actualCost':
        actualCost = parseNumber(val)
        break
      case 'plannedPercent':
        plannedPercent = parseNumber(val, isPercentCell)
        break
      case 'actualPercent':
        actualPercent = parseNumber(val, isPercentCell)
        break
    }
  }

  if (!taskName) {
    return { error: `Row ${rowIndex}: Missing required task/module name` }
  }

  try {
    const validated = workPackageSchema.parse({
      taskName,
      category,
      bac,
      plannedPercent,
      actualPercent,
      actualCost,
      notes
    })
    return { item: validated }
  } catch (err: unknown) {
    const issues =
      err instanceof ZodError
        ? err.issues.map((issue) => issue.message).join('; ')
        : err instanceof Error
          ? err.message
          : String(err)
    return { error: `Row ${rowIndex} (${taskName}): ${issues}` }
  }
}

/**
 * Parses a CSV file buffer or string into validated Work Packages.
 */
export async function parseCsvFile(file: File): Promise<ParseResult> {
  const text = await file.text()
  const sanitizationCounter = { count: 0 }
  const errors: string[] = []
  const items: ParsedWorkPackage[] = []

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: true
  })

  parsed.data.forEach((row, index) => {
    const { item, error } = mapRowToWorkPackage(row, index + 2, sanitizationCounter)
    if (item) {
      items.push(item)
    } else if (error) {
      errors.push(error)
    }
  })

  return { items, errors, sanitizedCount: sanitizationCounter.count }
}

/**
 * Parses an Excel (.xlsx / .xls) file into validated Work Packages.
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  // Web: exceljs is large, so it is loaded only when an Excel file is imported.
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return { items: [], errors: ['Excel file does not contain any worksheets.'], sanitizedCount: 0 }
  }

  const sanitizationCounter = { count: 0 }
  const errors: string[] = []
  const items: ParsedWorkPackage[] = []

  // Extract headers from the first row
  const headers: string[] = []
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim()
  })

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // Skip header
    const rowObj: Record<string, unknown> = {}
    const percentHeaders = new Set<string>()

    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber]
      if (header) {
        // Handle formula values or cell objects
        let val = cell.value
        if (val && typeof val === 'object' && 'result' in val) {
          val = val.result
        }
        if (val && typeof val === 'object' && 'richText' in val) {
          val = (val.richText as Array<{ text: string }>).map((part) => part.text).join('')
        }
        // Excel stores 50% as 0.5 in a %-formatted cell.
        if (
          typeof val === 'number' &&
          typeof cell.numFmt === 'string' &&
          cell.numFmt.includes('%')
        ) {
          percentHeaders.add(header)
        }
        rowObj[header] = val
      }
    })

    if (Object.keys(rowObj).length > 0) {
      const { item, error } = mapRowToWorkPackage(
        rowObj,
        rowNumber,
        sanitizationCounter,
        percentHeaders
      )
      if (item) {
        items.push(item)
      } else if (error) {
        errors.push(error)
      }
    }
  })

  return { items, errors, sanitizedCount: sanitizationCounter.count }
}

/**
 * Generates sample CSV template content for users to download.
 */
export function generateSampleCsvTemplate(): string {
  return [
    'Module Name,Category,Budget at Completion (BAC),Planned % Complete,Actual % Complete,Actual Cost (AC),Notes',
    'Live Runtime Error Listener & Code Auto-Patching System,Core Engineering,10000,50,40,5000,Core runtime listener benchmark module',
    'AST Static Analysis & Syntax Tree Parser,Core Engineering,15000,75,80,11000,Diff and syntax tree analyzer',
    'Sandboxed Execution & Regression Test Runner,Infrastructure & QA,12000,60,50,6500,Container sandbox runner',
    'High-Throughput Telemetry Ingestion Pipeline,Infrastructure & QA,8000,90,90,7200,ClickHouse & Kafka streaming',
    'Enterprise SSO & Role-Based Access Control,Security & Compliance,6000,40,30,3500,SAML and audit logging'
  ].join('\n')
}
