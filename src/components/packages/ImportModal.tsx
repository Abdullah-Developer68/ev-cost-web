import React, { useRef, useState } from 'react'
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  Upload
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import {
  generateSampleCsvTemplate,
  parseCsvFile,
  parseExcelFile,
  ParsedWorkPackage
} from '../../lib/fileParser'
import { calculateEvmMetrics } from '../../lib/calculations'
import { checkUpload, UPLOAD_LIMITS } from '../../lib/uploadGuard'
import { downloadTextFile } from '../../lib/csvExport'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/button'
import { toneOfIndex, TONE_TEXT } from '../ui/status'
import { cn, formatCurrency, formatIndex } from '../../lib/utils'
import { toast } from '../../store/useToastStore'

interface ParseState {
  fileName: string
  rows: ParsedWorkPackage[]
  errors: string[]
  sanitizedCount: number
  /** The whole file was refused before parsing (wrong type, unsafe content, too large). */
  rejected?: boolean
}

const ImportBody: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const currency = useAppStore((s) => s.currency)
  const importItems = useCostStore((s) => s.importItems)
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ParseState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleFile = async (file: File): Promise<void> => {
    const reject = (error: string): void =>
      setState({
        fileName: file.name,
        rows: [],
        errors: [error],
        sanitizedCount: 0,
        rejected: true
      })
    setParsing(true)
    try {
      // Name, size and content checks before any parser sees the bytes.
      const check = await checkUpload(file)
      if (!check.ok) {
        reject(check.error)
        return
      }
      const result = check.kind === 'xlsx' ? await parseExcelFile(file) : await parseCsvFile(file)
      if (result.items.length + result.errors.length > UPLOAD_LIMITS.maxRows) {
        reject(
          `The file has more than ${UPLOAD_LIMITS.maxRows.toLocaleString('en-US')} rows. Split it and import the parts.`
        )
        return
      }
      setState({
        fileName: file.name,
        rows: result.items,
        errors: result.errors,
        sanitizedCount: result.sanitizedCount
      })
    } catch (err) {
      setState({
        fileName: file.name,
        rows: [],
        errors: [`Couldn't read the file: ${err instanceof Error ? err.message : String(err)}`],
        sanitizedCount: 0
      })
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = '' // allow re-selecting the same file
    }
  }

  const confirm = async (): Promise<void> => {
    if (!state?.rows.length) return
    setImporting(true)
    try {
      const count = await importItems(state.rows)
      toast.success(`Imported ${count} work package${count === 1 ? '' : 's'}`)
      onClose()
    } catch (err) {
      setState(
        (s) =>
          s && {
            ...s,
            errors: [
              `Import failed: ${err instanceof Error ? err.message : String(err)}`,
              ...s.errors
            ]
          }
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <div className="space-y-4 px-4 py-5 sm:px-6">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging
              ? 'border-spot bg-subtle'
              : 'border-rule-strong bg-plane hover:border-ink-3 hover:bg-subtle'
          )}
        >
          <FileSpreadsheet className="size-7 text-ink-3" aria-hidden />
          <span className="text-ui font-semibold text-ink">
            {parsing
              ? 'Reading…'
              : state
                ? state.fileName
                : 'Drop a CSV or Excel file here, or click to browse'}
          </span>
          <span className="text-small text-ink-3">
            Columns: name, category, BAC, planned %, actual %, actual cost, notes. Header names are
            matched flexibly.
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        {state && (
          <div className="flex flex-wrap gap-2 text-small" aria-live="polite">
            {state.rejected ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-bad-bg px-2 py-1 font-semibold text-bad">
                <ShieldAlert className="size-3.5" aria-hidden />
                File refused: nothing was read
              </span>
            ) : (
              <span className="rounded-sm bg-good-bg px-2 py-1 font-semibold text-good">
                {state.rows.length} ready to import
              </span>
            )}
            {state.errors.length > 0 && !state.rejected && (
              <span className="rounded-sm bg-risk-bg px-2 py-1 font-semibold text-risk">
                {state.errors.length} row{state.errors.length === 1 ? '' : 's'} skipped
              </span>
            )}
            {state.sanitizedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-subtle px-2 py-1 font-semibold text-ink-3">
                <ShieldCheck className="size-3.5" aria-hidden />
                {state.sanitizedCount} formula prefix{state.sanitizedCount === 1 ? '' : 'es'}{' '}
                removed
              </span>
            )}
          </div>
        )}

        {state && state.errors.length > 0 && (
          <div className="rounded border border-risk/25 bg-risk-bg px-4 py-3">
            <div className="flex items-center gap-1.5 text-body font-semibold text-risk">
              <AlertTriangle className="size-4" aria-hidden />
              {state.rejected ? 'Why the file was refused' : 'Skipped rows'}
            </div>
            <ul className="mt-1 max-h-28 list-disc space-y-0.5 overflow-auto pl-5 text-small text-ink-2">
              {state.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {state && state.rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-rule">
            <div className="max-h-60 overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-small">
                <thead className="sticky top-0 bg-paper">
                  <tr className="text-ink-3">
                    {[
                      'Work package',
                      'Category',
                      'BAC',
                      'Plan %',
                      'Actual %',
                      'AC',
                      'CPI',
                      'SPI'
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'border-b border-rule px-3 py-2 font-semibold',
                          i > 1 ? 'text-right' : 'text-left'
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, i) => {
                    const m = calculateEvmMetrics(row)
                    return (
                      <tr key={i}>
                        <td
                          className="max-w-[220px] truncate border-b border-rule px-3 py-1.5 font-semibold text-ink"
                          title={row.taskName}
                        >
                          {row.taskName}
                        </td>
                        <td className="border-b border-rule px-3 py-1.5 text-ink-2">
                          {row.category}
                        </td>
                        <td className="num border-b border-rule px-3 py-1.5 text-right">
                          {formatCurrency(row.bac, currency)}
                        </td>
                        <td className="num border-b border-rule px-3 py-1.5 text-right">
                          {row.plannedPercent}%
                        </td>
                        <td className="num border-b border-rule px-3 py-1.5 text-right">
                          {row.actualPercent}%
                        </td>
                        <td className="num border-b border-rule px-3 py-1.5 text-right">
                          {formatCurrency(row.actualCost, currency)}
                        </td>
                        <td
                          className={cn(
                            'num border-b border-rule px-3 py-1.5 text-right font-semibold',
                            TONE_TEXT[toneOfIndex(m.cpi)]
                          )}
                        >
                          {formatIndex(m.cpi)}
                        </td>
                        <td
                          className={cn(
                            'num border-b border-rule px-3 py-1.5 text-right font-semibold',
                            TONE_TEXT[toneOfIndex(m.spi)]
                          )}
                        >
                          {formatIndex(m.spi)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-plane px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
        <Button
          variant="ghost"
          className="mr-auto"
          onClick={() =>
            downloadTextFile(generateSampleCsvTemplate(), 'ev-cost-template.csv', 'text/csv')
          }
        >
          <Download aria-hidden />
          Sample template
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={confirm}
          loading={importing}
          disabled={!state?.rows.length || parsing}
        >
          <Upload aria-hidden />
          {state?.rows.length
            ? `Import ${state.rows.length} work package${state.rows.length === 1 ? '' : 's'}`
            : 'Import'}
        </Button>
      </footer>
    </>
  )
}

export const ImportModal: React.FC = () => {
  const isOpen = useAppStore((s) => s.isImportModalOpen)
  const setIsImportModalOpen = useAppStore((s) => s.setIsImportModalOpen)
  if (!isOpen) return null
  const close = (): void => setIsImportModalOpen(false)
  return (
    <Modal
      title="Import work packages"
      description="From CSV or Excel. Text cells are cleaned of spreadsheet formulas before they are saved."
      onClose={close}
      width="lg"
    >
      <ImportBody onClose={close} />
    </Modal>
  )
}
