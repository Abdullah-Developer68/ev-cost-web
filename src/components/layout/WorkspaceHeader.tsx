import React from 'react'
import { Download, Plus, Upload } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { useActiveProject, useProjectSummary } from '../../hooks/useEvm'
import { Button } from '../ui/button'
import { formatCurrency } from '../../lib/utils'
import { exportWorkPackagesCsv } from '../../store/exportActions'

export const WorkspaceHeader: React.FC = () => {
  const project = useActiveProject()
  const summary = useProjectSummary()
  const items = useCostStore((s) => s.items)
  const isBooting = useCostStore((s) => s.isBooting)
  const currency = useAppStore((s) => s.currency)
  const setIsAddModalOpen = useAppStore((s) => s.setIsAddModalOpen)
  const setIsImportModalOpen = useAppStore((s) => s.setIsImportModalOpen)

  if (isBooting) {
    return (
      <header className="px-4 pb-5 pt-5 sm:px-8 sm:pt-7">
        <div className="skeleton h-8 w-[420px] max-w-full" />
        <div className="skeleton mt-3 h-4 w-[300px] max-w-full" />
      </header>
    )
  }

  return (
    <header className="flex flex-col justify-between gap-4 px-4 pb-5 pt-5 sm:flex-row sm:items-start sm:gap-6 sm:px-8 sm:pt-7">
      <div className="min-w-0">
        <h1
          className="line-clamp-2 font-display text-h1 font-semibold text-ink"
          title={project?.name}
        >
          {project?.name ?? 'No project selected'}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-body text-ink-3">
          {project?.description && (
            <>
              <span className="max-w-full basis-full truncate sm:max-w-[56ch] sm:basis-auto">
                {project.description}
              </span>
              <span aria-hidden className="max-sm:hidden">
                ·
              </span>
            </>
          )}
          <span className="num">
            {summary.totalModules} work package{summary.totalModules === 1 ? '' : 's'}
          </span>
          <span aria-hidden>·</span>
          <span className="num">Budget {formatCurrency(summary.bac, currency)}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button onClick={() => setIsImportModalOpen(true)} disabled={!project}>
          <Upload aria-hidden />
          Import
        </Button>
        <Button onClick={exportWorkPackagesCsv} disabled={!project || items.length === 0}>
          <Download aria-hidden />
          Export CSV
        </Button>
        <Button
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          disabled={!project}
          title="New work package (N)"
          className="max-lg:hidden"
        >
          <Plus aria-hidden />
          Work package
        </Button>
      </div>
    </header>
  )
}
