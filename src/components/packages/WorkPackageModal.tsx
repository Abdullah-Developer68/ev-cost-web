import React, { useMemo, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { useCategories } from '../../hooks/useEvm'
import { calculateEvmMetrics, healthOf } from '../../lib/calculations'
import { workPackageSchema } from '../../lib/validators'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/button'
import { AffixInput, Field, inputClass } from '../ui/field'
import { HealthBadge } from '../ui/status'
import { WorkedSolution } from '../ui/worked'
import { buildSolutions } from '../worked/solutions'
import { toast } from '../../store/useToastStore'
import type { WorkPackageItem } from '../../types'

type Draft = {
  taskName: string
  category: string
  bac: string
  plannedPercent: string
  actualPercent: string
  actualCost: string
  notes: string
}

type Errors = Partial<Record<keyof Draft, string>>

const blank: Draft = {
  taskName: '',
  category: '',
  bac: '',
  plannedPercent: '',
  actualPercent: '',
  actualCost: '',
  notes: ''
}

function toDraft(item: WorkPackageItem | null): Draft {
  if (!item) return blank
  return {
    taskName: item.taskName,
    category: item.category,
    bac: String(item.bac),
    plannedPercent: String(item.plannedPercent),
    actualPercent: String(item.actualPercent),
    actualCost: String(item.actualCost),
    notes: item.notes ?? ''
  }
}

const num = (v: string): number => (v.trim() === '' ? 0 : Number(v))

function validate(draft: Draft): {
  errors: Errors
  data?: ReturnType<typeof workPackageSchema.parse>
} {
  const errors: Errors = {}
  for (const key of ['bac', 'plannedPercent', 'actualPercent', 'actualCost'] as const) {
    if (draft[key].trim() === '') errors[key] = 'Required'
    else if (!Number.isFinite(Number(draft[key]))) errors[key] = 'Enter a number'
  }
  const parsed = workPackageSchema.safeParse({
    taskName: draft.taskName.trim(),
    category: draft.category.trim() || 'General',
    bac: num(draft.bac),
    plannedPercent: num(draft.plannedPercent),
    actualPercent: num(draft.actualPercent),
    actualCost: num(draft.actualCost),
    notes: draft.notes
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof Draft
      if (!errors[key]) errors[key] = issue.message
    }
  }
  return {
    errors,
    data: parsed.success && Object.keys(errors).length === 0 ? parsed.data : undefined
  }
}

const WorkPackageForm: React.FC<{ initial: WorkPackageItem | null; onClose: () => void }> = ({
  initial,
  onClose
}) => {
  const currency = useAppStore((s) => s.currency)
  const addItem = useCostStore((s) => s.addItem)
  const updateItem = useCostStore((s) => s.updateItem)
  const categories = useCategories()

  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [touched, setTouched] = useState<Partial<Record<keyof Draft, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const { errors, data } = useMemo(() => validate(draft), [draft])
  const showError = (key: keyof Draft): string | undefined =>
    submitted || touched[key] ? errors[key] : undefined

  const preview = useMemo(
    () =>
      calculateEvmMetrics({
        bac: num(draft.bac) || 0,
        plannedPercent: num(draft.plannedPercent) || 0,
        actualPercent: num(draft.actualPercent) || 0,
        actualCost: num(draft.actualCost) || 0
      }),
    [draft.bac, draft.plannedPercent, draft.actualPercent, draft.actualCost]
  )
  const previewSolutions = buildSolutions(preview, currency).filter((s) =>
    ['cpi', 'spi', 'eac', 'vac'].includes(s.key)
  )
  const hasNumbers = preview.bac > 0

  const set =
    (key: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
      setDraft((d) => ({ ...d, [key]: e.target.value }))
  const blur = (key: keyof Draft) => (): void => setTouched((t) => ({ ...t, [key]: true }))

  const save = async (addAnother: boolean): Promise<void> => {
    setSubmitted(true)
    setServerError('')
    if (!data) return
    setSaving(true)
    try {
      if (initial) {
        await updateItem({ id: initial.id, ...data })
        toast.success(`Saved “${data.taskName}”`)
        onClose()
      } else {
        await addItem(data)
        toast.success(`Added “${data.taskName}”`)
        if (addAnother) {
          setDraft({ ...blank, category: data.category })
          setTouched({})
          setSubmitted(false)
        } else {
          onClose()
        }
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save(false)
      }}
      noValidate
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4 px-4 py-5 sm:px-6">
          {serverError && (
            <p
              role="alert"
              className="rounded border border-bad/30 bg-bad-bg px-3 py-2 text-body font-semibold text-bad"
            >
              Couldn&apos;t save: {serverError}
            </p>
          )}
          <Field label="Work package name" required error={showError('taskName')}>
            {(a) => (
              <input
                {...a}
                data-autofocus
                className={inputClass}
                value={draft.taskName}
                onChange={set('taskName')}
                onBlur={blur('taskName')}
                placeholder="e.g. Payments API integration"
                maxLength={255}
              />
            )}
          </Field>
          <Field
            label="Category"
            hint="Groups packages in the category breakdown"
            error={showError('category')}
          >
            {(a) => (
              <>
                <input
                  {...a}
                  list="category-options"
                  className={inputClass}
                  value={draft.category}
                  onChange={set('category')}
                  onBlur={blur('category')}
                  placeholder="General"
                  maxLength={100}
                />
                <datalist id="category-options">
                  {categories.map((c) => (
                    <option key={c.name} value={c.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Budget at completion (BAC)" required error={showError('bac')}>
              {(a) => (
                <AffixInput
                  {...a}
                  prefix={currency}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={draft.bac}
                  onChange={set('bac')}
                  onBlur={blur('bac')}
                  placeholder="10000"
                />
              )}
            </Field>
            <Field label="Actual cost so far (AC)" required error={showError('actualCost')}>
              {(a) => (
                <AffixInput
                  {...a}
                  prefix={currency}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={draft.actualCost}
                  onChange={set('actualCost')}
                  onBlur={blur('actualCost')}
                  placeholder="5000"
                />
              )}
            </Field>
            <Field
              label="Planned % complete"
              required
              hint="Where the plan says it should be today"
              error={showError('plannedPercent')}
            >
              {(a) => (
                <AffixInput
                  {...a}
                  suffix="%"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="any"
                  value={draft.plannedPercent}
                  onChange={set('plannedPercent')}
                  onBlur={blur('plannedPercent')}
                  placeholder="50"
                />
              )}
            </Field>
            <Field
              label="Actual % complete"
              required
              hint="How much of the work is really done"
              error={showError('actualPercent')}
            >
              {(a) => (
                <AffixInput
                  {...a}
                  suffix="%"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="any"
                  value={draft.actualPercent}
                  onChange={set('actualPercent')}
                  onBlur={blur('actualPercent')}
                  placeholder="40"
                />
              )}
            </Field>
          </div>
          <Field label="Notes">
            {(a) => (
              <textarea
                {...a}
                rows={2}
                className={`${inputClass} h-auto py-2`}
                value={draft.notes}
                onChange={set('notes')}
                placeholder="Optional context for the report"
                maxLength={2000}
              />
            )}
          </Field>
        </div>

        <aside
          className="border-rule bg-plane px-4 py-5 max-sm:border-t sm:border-l sm:px-5"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <h3 className="label-caps">Live preview</h3>
            {hasNumbers && <HealthBadge level={healthOf(preview.cpi, preview.spi).level} />}
          </div>
          {hasNumbers ? (
            <div className="mt-3 space-y-4">
              {previewSolutions.map(({ key, ...spec }) => (
                <WorkedSolution key={key} size="sm" {...spec} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-body text-ink-3">
              Enter a budget and progress to see CPI, SPI and the forecast worked out as you type.
            </p>
          )}
        </aside>
      </div>
      <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-plane px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
        <span className="mr-auto text-caption text-ink-3 max-sm:hidden">Press Enter to save</span>
        <Button onClick={onClose}>Cancel</Button>
        {!initial && (
          <Button onClick={() => save(true)} disabled={saving}>
            Save and add another
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving}>
          {initial ? 'Save changes' : 'Add work package'}
        </Button>
      </footer>
    </form>
  )
}

export const WorkPackageModal: React.FC = () => {
  const isOpen = useAppStore((s) => s.isAddModalOpen)
  const editingItem = useAppStore((s) => s.editingItem)
  const setIsAddModalOpen = useAppStore((s) => s.setIsAddModalOpen)

  if (!isOpen) return null
  const close = (): void => setIsAddModalOpen(false)

  return (
    <Modal
      title={editingItem ? 'Edit work package' : 'New work package'}
      description="Four inputs; the other eight EVM metrics are derived."
      onClose={close}
      width="lg"
    >
      <WorkPackageForm key={editingItem?.id ?? 'new'} initial={editingItem} onClose={close} />
    </Modal>
  )
}
