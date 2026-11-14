import { useMemo } from 'react'
import {
  Download,
  FileDown,
  FileText,
  FolderGit2,
  FolderPlus,
  LayoutGrid,
  ListChecks,
  Monitor,
  Moon,
  Package,
  Plus,
  Search,
  Settings2,
  Sun,
  Table2,
  Upload
} from 'lucide-react'
import type { Command } from '../../lib/commands'
import { useAppStore } from '../../store/useAppStore'
import { useCostStore } from '../../store/useCostStore'
import { exportReportPdf, exportWorkPackagesCsv } from '../../store/exportActions'
import { pageShortcut, usePlatformCommands } from '../../platform/commands'

/** Everything the command menu offers, built from the current state of the app. */
export function useCommands(): Command[] {
  const projects = useCostStore((s) => s.projects)
  const activeProjectId = useCostStore((s) => s.activeProjectId)
  const items = useCostStore((s) => s.items)
  const selectProject = useCostStore((s) => s.selectProject)
  const platformCommands = usePlatformCommands()

  return useMemo(() => {
    const app = useAppStore.getState()
    const hasProject = activeProjectId !== null
    const hasItems = items.length > 0

    const goTo: Command[] = [
      {
        id: 'go-overview',
        group: 'Go to',
        label: 'Overview',
        icon: LayoutGrid,
        keywords: 'go dashboard home summary health',
        shortcut: pageShortcut('1'),
        run: () => app.setActiveTab('dashboard')
      },
      {
        id: 'go-packages',
        group: 'Go to',
        label: 'Work packages',
        icon: Table2,
        keywords: 'go table cost sheet list',
        shortcut: pageShortcut('2'),
        run: () => app.setActiveTab('costs')
      },
      {
        id: 'go-actions',
        group: 'Go to',
        label: 'Next actions',
        icon: ListChecks,
        keywords: 'go suggestions advice recommendations what if forecast',
        shortcut: pageShortcut('3'),
        run: () => app.setActiveTab('actions')
      },
      {
        id: 'go-report',
        group: 'Go to',
        label: 'Report',
        icon: FileText,
        keywords: 'go pdf print preview audit',
        shortcut: pageShortcut('4'),
        run: () => app.setActiveTab('reports')
      }
    ]

    const actions: Command[] = []
    if (hasProject) {
      actions.push(
        {
          id: 'package-new',
          group: 'Actions',
          label: 'New work package',
          icon: Plus,
          keywords: 'add create task module',
          shortcut: 'N',
          run: () => app.setIsAddModalOpen(true)
        },
        {
          id: 'package-import',
          group: 'Actions',
          label: 'Import work packages',
          icon: Upload,
          keywords: 'csv xlsx excel spreadsheet upload bulk',
          run: () => app.setIsImportModalOpen(true)
        }
      )
    }
    if (hasItems) {
      actions.push(
        {
          id: 'package-search',
          group: 'Actions',
          label: 'Search work packages',
          icon: Search,
          keywords: 'find filter',
          shortcut: '/',
          run: () => {
            app.setActiveTab('costs')
            requestAnimationFrame(() => document.getElementById('package-search')?.focus())
          }
        },
        {
          id: 'export-csv',
          group: 'Actions',
          label: 'Export work packages to CSV',
          icon: Download,
          keywords: 'download spreadsheet excel save',
          run: exportWorkPackagesCsv
        },
        {
          id: 'export-pdf',
          group: 'Actions',
          label: 'Download the PDF report',
          icon: FileDown,
          keywords: 'export print audit save',
          run: () => {
            exportReportPdf()
          }
        }
      )
    }

    const projectCommands: Command[] = [
      {
        id: 'project-new',
        group: 'Projects',
        label: 'New project',
        icon: FolderPlus,
        keywords: 'add create',
        run: () => app.setIsSettingsModalOpen(true, 'create')
      }
    ]
    if (hasProject) {
      projectCommands.push({
        id: 'project-settings',
        group: 'Projects',
        label: 'Project settings',
        icon: Settings2,
        keywords: 'rename currency delete edit',
        run: () => app.setIsSettingsModalOpen(true, 'edit')
      })
    }
    for (const project of projects) {
      if (project.id === activeProjectId) continue
      projectCommands.push({
        id: `project-${project.id}`,
        group: 'Projects',
        label: `Switch to ${project.name}`,
        icon: FolderGit2,
        keywords: 'open change project',
        run: () => {
          selectProject(project.id)
        }
      })
    }

    const appearance: Command[] = [
      {
        id: 'theme-light',
        group: 'Appearance',
        label: 'Light theme',
        icon: Sun,
        keywords: 'appearance day bright mode',
        run: () => app.setTheme('light')
      },
      {
        id: 'theme-dark',
        group: 'Appearance',
        label: 'Dark theme',
        icon: Moon,
        keywords: 'appearance night mode',
        run: () => app.setTheme('dark')
      },
      {
        id: 'theme-system',
        group: 'Appearance',
        label: 'Match the system theme',
        icon: Monitor,
        keywords: 'appearance auto os automatic mode',
        run: () => app.setTheme('system')
      }
    ]

    // Individual work packages only show up in search results.
    const packages: Command[] = items.map((item) => ({
      id: `package-${item.id}`,
      group: 'Work packages',
      label: item.taskName,
      detail: item.category || 'General',
      icon: Package,
      keywords: `open inspect ${item.notes ?? ''}`,
      searchOnly: true,
      run: () => {
        app.setActiveTab('costs')
        app.setInspectedItem(item)
      }
    }))

    return [
      ...goTo,
      ...actions,
      ...projectCommands,
      ...appearance,
      ...platformCommands,
      ...packages
    ]
  }, [projects, activeProjectId, items, selectProject, platformCommands])
}
