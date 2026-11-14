/**
 * Pure input normalisation for IPC payloads. The renderer validates too, but
 * the main process never trusts it: every value is coerced and clamped here.
 */

export interface WorkPackageInput {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes?: string | null
}

export interface NormalizedWorkPackage {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes: string
}

const MAX_TEXT = 255
const MAX_NOTES = 2000

/**
 * Strips spreadsheet formula-injection prefixes (=, +, -, @, tab, CR) and trims.
 * Whitespace counts as part of the prefix, so "  =cmd" cannot slip through and
 * become "=cmd" after trimming.
 */
export function sanitizeInputString(val?: string | null, maxLength = MAX_TEXT): string {
  if (typeof val !== 'string' || !val) return ''
  return val
    .replace(/^[\s=+\-@]+/, '')
    .trim()
    .slice(0, maxLength)
}

function toNumber(val: unknown): number {
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : 0
}

const clampPercent = (val: unknown): number => Math.min(100, Math.max(0, toNumber(val)))
const nonNegative = (val: unknown): number => Math.max(0, toNumber(val))

export function normalizeWorkPackage(
  data: Partial<WorkPackageInput> | null | undefined,
  fallbackName = 'Untitled Work Package'
): NormalizedWorkPackage {
  const d = data ?? {}
  return {
    taskName: sanitizeInputString(d.taskName) || fallbackName,
    category: sanitizeInputString(d.category, 128) || 'General',
    bac: nonNegative(d.bac),
    plannedPercent: clampPercent(d.plannedPercent),
    actualPercent: clampPercent(d.actualPercent),
    actualCost: nonNegative(d.actualCost),
    notes: sanitizeInputString(d.notes, MAX_NOTES)
  }
}

export interface ProjectInput {
  name?: string
  description?: string | null
  currency?: string
}

const ALLOWED_CURRENCY = /^[\p{Sc}A-Za-z]{1,4} ?$/u

export function normalizeCurrency(val?: string): string {
  if (typeof val !== 'string') return '$'
  const trimmedEnd = val.slice(0, 5)
  return ALLOWED_CURRENCY.test(trimmedEnd) ? trimmedEnd : '$'
}

export function normalizeProject(data: ProjectInput | null | undefined): {
  name: string
  description: string
  currency: string
} {
  const d = data ?? {}
  return {
    name: sanitizeInputString(d.name) || 'Untitled Project',
    description: sanitizeInputString(d.description, 500),
    currency: normalizeCurrency(d.currency)
  }
}

/** Positive integer id, or throws. Guards every handler that takes an id. */
export function assertId(val: unknown, label = 'id'): number {
  const n = Number(val)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${label}`)
  return n
}
