import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { useActiveProject } from '../../hooks/useEvm'
import { projectSchema } from '../../lib/validators'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/button'
import { Field, inputClass } from '../ui/field'
import { cn } from '../../lib/utils'
import type { Project } from '../../types'

const CURRENCIES = [
  { symbol: '$', label: 'US dollar', code: 'USD' },
  { symbol: '€', label: 'Euro', code: 'EUR' },
  { symbol: '£', label: 'British pound', code: 'GBP' },
  { symbol: 'PKR ', label: 'Pakistani rupee', code: 'PKR' },
  { symbol: '₹', label: 'Indian rupee', code: 'INR' },
  { symbol: '¥', label: 'Japanese yen', code: 'JPY' }
]

const SettingsForm: React.FC<{
  project: Project | undefined
  mode: 'edit' | 'create'
  onClose: () => void
}> = ({ project, mode, onClose }) => {
  const createProject = useCostStore((s) => s.createProject)
  const updateProject = useCostStore((s) => s.updateProject)
  const deleteProject = useCostStore((s) => s.deleteProject)
  const projectCount = useCostStore((s) => s.projects.length)
  const requestConfirm = useAppStore((s) => s.requestConfirm)

  const editing = mode === 'edit' && project
  const [name, setName] = useState(editing ? project.name : '')
  const [description, setDescription] = useState(editing ? (project.description ?? '') : '')
  const [currency, setCurrency] = useState(editing ? project.currency : '$')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const parsed = projectSchema.safeParse({ name: name.trim(), description, currency })
  const nameError =
    submitted && !parsed.success
      ? parsed.error.issues.find((i) => i.path[0] === 'name')?.message
      : undefined

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSubmitted(true)
    if (!parsed.success) return
    setSaving(true)
    try {
      if (editing) await updateProject(project.id, parsed.data)
      else await createProject(parsed.data.name, parsed.data.description, parsed.data.currency)
      onClose()
    } catch {
      // the store already showed the error
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-4 px-4 py-5 sm:px-6">
        <Field label="Project name" required error={nameError}>
          {(a) => (
            <input
              {...a}
              data-autofocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile banking app, release 2"
              maxLength={255}
            />
          )}
        </Field>
        <Field label="Description" hint="Shown under the project name and on the report">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope or charter in one line"
              maxLength={500}
            />
          )}
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-small font-semibold text-ink-2">Currency</legend>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCIES.map((c) => {
              const selected = currency === c.symbol
              return (
                <label
                  key={c.code}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-body transition-colors',
                    selected
                      ? 'border-spot bg-subtle font-semibold text-ink ring-1 ring-spot'
                      : 'border-rule-strong hover:border-ink-3'
                  )}
                >
                  <input
                    type="radio"
                    name="currency"
                    value={c.symbol}
                    checked={selected}
                    onChange={() => setCurrency(c.symbol)}
                    className="sr-only"
                  />
                  <span className="w-8 font-semibold text-ink-3">{c.symbol.trim()}</span>
                  <span className="truncate">{c.code}</span>
                </label>
              )
            })}
          </div>
          <p className="mt-1.5 text-caption text-ink-3">
            Changes the symbol only; amounts are not converted.
          </p>
        </fieldset>

        {editing && (
          <div className="mt-2 flex items-center justify-between rounded border border-bad/25 px-4 py-3">
            <div>
              <div className="text-body font-semibold text-ink">Delete this project</div>
              <div className="text-small text-ink-3">
                Removes the project and all its work packages. This cannot be undone.
              </div>
            </div>
            <Button
              variant="danger-ghost"
              size="sm"
              disabled={projectCount <= 1}
              title={projectCount <= 1 ? 'Create another project first' : undefined}
              onClick={() =>
                requestConfirm({
                  title: `Delete “${project.name}”?`,
                  body: 'The project and every work package in it will be permanently deleted.',
                  confirmLabel: 'Delete project',
                  tone: 'danger',
                  onConfirm: async () => {
                    await deleteProject(project.id)
                    onClose()
                  }
                })
              }
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          </div>
        )}
      </div>
      <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-plane px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>
          {editing ? 'Save project' : 'Create project'}
        </Button>
      </footer>
    </form>
  )
}

export const ProjectSettingsModal: React.FC = () => {
  const isOpen = useAppStore((s) => s.isSettingsModalOpen)
  const mode = useAppStore((s) => s.settingsMode)
  const setIsSettingsModalOpen = useAppStore((s) => s.setIsSettingsModalOpen)
  const project = useActiveProject()

  if (!isOpen) return null
  const close = (): void => setIsSettingsModalOpen(false)
  const editing = mode === 'edit' && project

  return (
    <Modal
      title={editing ? 'Project settings' : 'New project'}
      description={editing ? project.name : 'Projects keep their own work packages and currency.'}
      onClose={close}
      width="md"
    >
      <SettingsForm
        key={`${mode}-${project?.id ?? 'none'}`}
        project={project}
        mode={mode}
        onClose={close}
      />
    </Modal>
  )
}
