import { useAppStore } from './useAppStore'
import { useCostStore } from './useCostStore'
import { errorMessage, toast } from './useToastStore'
import { calculateProjectEvmSummary } from '../lib/calculations'
import { buildWorkPackagesCsv, downloadTextFile, slugify } from '../lib/csvExport'
import type { ReportSections } from '../lib/pdfExport'
import { generateSuggestions } from '../lib/suggestions'
import { detectSpendAnomalies } from '../lib/anomalies'

export const ALL_REPORT_SECTIONS: ReportSections = {
  summary: true,
  chart: true,
  table: true,
  actions: true,
  anomalies: true,
  scenarios: true
}

function activeProject(): { name: string; description: string | null } | undefined {
  const { projects, activeProjectId } = useCostStore.getState()
  return projects.find((p) => p.id === activeProjectId)
}

/**
 * Downloads the active project's work packages as a CSV. One implementation for
 * every place that offers it (the header button and the command menu).
 */
export function exportWorkPackagesCsv(): void {
  const project = activeProject()
  const { items } = useCostStore.getState()
  if (!project || items.length === 0) {
    toast.info('There are no work packages to export yet')
    return
  }
  downloadTextFile(
    buildWorkPackagesCsv(items),
    `${slugify(project.name)}-work-packages.csv`,
    'text/csv'
  )
  toast.success(`Exported ${items.length} work package${items.length === 1 ? '' : 's'} to CSV`)
}

/** Downloads the PDF report for the active project with the chosen sections. */
export async function exportReportPdf(
  sections: ReportSections = ALL_REPORT_SECTIONS
): Promise<void> {
  const project = activeProject()
  const { items } = useCostStore.getState()
  const { currency } = useAppStore.getState()
  if (!project || items.length === 0) {
    toast.info('Add a work package before creating a report')
    return
  }
  try {
    // Yield a frame so the caller can show a busy state before the PDF is built.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    // jsPDF is loaded on demand so it stays out of the first download.
    const { exportEvmReportPdf } = await import('../lib/pdfExport')
    exportEvmReportPdf({
      projectName: project.name,
      description: project.description,
      currency,
      summary: calculateProjectEvmSummary(items),
      items,
      suggestions: generateSuggestions(items, currency),
      anomalies: detectSpendAnomalies(items, currency),
      sections
    })
    toast.success('PDF report downloaded')
  } catch (err: unknown) {
    toast.error(`Couldn't create the PDF: ${errorMessage(err)}`)
  }
}
