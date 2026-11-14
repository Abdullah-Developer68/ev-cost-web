import React from 'react'
import { Download, FolderPlus, Plus, Upload } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/panel'
import { generateSampleCsvTemplate } from '../../lib/fileParser'
import { downloadTextFile } from '../../lib/csvExport'

/** First-run states: no project yet, or a project with no work packages. */
export const EmptyProject: React.FC = () => {
  const projects = useCostStore((s) => s.projects)
  const setIsAddModalOpen = useAppStore((s) => s.setIsAddModalOpen)
  const setIsImportModalOpen = useAppStore((s) => s.setIsImportModalOpen)
  const setIsSettingsModalOpen = useAppStore((s) => s.setIsSettingsModalOpen)

  if (projects.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<FolderPlus className="size-6" />}
          title="Start with a project"
          body="A project holds work packages, each with a budget (BAC), planned and actual progress, and the cost spent so far."
          actions={
            <Button variant="primary" onClick={() => setIsSettingsModalOpen(true, 'create')}>
              <FolderPlus aria-hidden />
              Create a project
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="card">
      <EmptyState
        icon={<Plus className="size-6" />}
        title="Add the first work package"
        body={
          <>
            Each work package needs four numbers: its budget (<var className="math">BAC</var>),
            planned % complete, actual % complete and actual cost (<var className="math">AC</var>).
            EV-COST derives the other eight metrics, shows the working, and suggests what to do.
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus aria-hidden />
              Add work package
            </Button>
            <Button onClick={() => setIsImportModalOpen(true)}>
              <Upload aria-hidden />
              Import CSV or Excel
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                downloadTextFile(generateSampleCsvTemplate(), 'ev-cost-template.csv', 'text/csv')
              }
            >
              <Download aria-hidden />
              Sample template
            </Button>
          </>
        }
      />
    </div>
  )
}
