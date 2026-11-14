import { z } from 'zod'

/**
 * Strips dangerous spreadsheet formula injection prefixes (=, +, -, @, \t, \r)
 * from text inputs before database storage or export. Leading whitespace is
 * treated as part of the prefix so " =SUM()" cannot survive the final trim.
 */
export function sanitizeFormulaInjection(val: string): {
  sanitized: string
  wasModified: boolean
} {
  if (typeof val !== 'string') {
    return { sanitized: '', wasModified: false }
  }

  const formulaPrefixRegex = /^\s*[=+\-@][\s=+\-@]*/
  const wasModified = formulaPrefixRegex.test(val)
  const sanitized = val.replace(formulaPrefixRegex, '').trim()

  return { sanitized, wasModified }
}

export const workPackageSchema = z.object({
  taskName: z
    .string()
    .min(1, 'Module name is required')
    .max(255, 'Module name too long')
    .transform((val) => sanitizeFormulaInjection(val).sanitized),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category too long')
    .default('General')
    .transform((val) => sanitizeFormulaInjection(val).sanitized),
  bac: z.coerce.number().min(0, 'Budget at Completion (BAC) cannot be negative'),
  plannedPercent: z.coerce
    .number()
    .min(0, 'Planned % cannot be negative')
    .max(100, 'Planned % cannot exceed 100%'),
  actualPercent: z.coerce
    .number()
    .min(0, 'Actual % cannot be negative')
    .max(100, 'Actual % cannot exceed 100%'),
  actualCost: z.coerce.number().min(0, 'Actual Cost (AC) cannot be negative'),
  notes: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeFormulaInjection(val).sanitized : ''))
})

export type WorkPackageFormData = z.infer<typeof workPackageSchema>

export const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(255, 'Project name too long')
    .transform((val) => sanitizeFormulaInjection(val).sanitized),
  description: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeFormulaInjection(val).sanitized : '')),
  currency: z.string().min(1).max(10).default('$')
})

export type ProjectFormData = z.infer<typeof projectSchema>
