import { useAppStore } from '../store/useAppStore'
import { useCostStore } from '../store/useCostStore'
import { errorMessage, toast } from '../store/useToastStore'
import { downloadTextFile } from '../lib/csvExport'
import { api } from './api'

/**
 * The web-only data tools: download a backup, restore one, reset to the demo.
 * One implementation for every place that offers them (the sidebar's data menu
 * and the command menu).
 */

/** Backups larger than this are refused before they are read: localStorage holds ~5 MB. */
const MAX_BACKUP_BYTES = 10 * 1024 * 1024

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

function backupFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `ev-cost-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

export function downloadBackup(): void {
  try {
    downloadTextFile(api.data.exportBackup(), backupFileName(new Date()), 'application/json')
    toast.success('Backup downloaded')
  } catch (err: unknown) {
    toast.error(`Couldn't create the backup: ${errorMessage(err)}`)
  }
}

/** Reads a backup file, says what it holds, and asks before replacing the data. */
export async function restoreBackupFile(file: File): Promise<void> {
  if (file.size > MAX_BACKUP_BYTES) {
    toast.error('That file is too large to be an EV-COST backup.')
    return
  }
  let text: string
  let found: { projects: number; items: number; skipped: number }
  try {
    text = await file.text()
    found = api.data.inspectBackup(text)
  } catch (err: unknown) {
    toast.error(errorMessage(err))
    return
  }
  const current = useCostStore.getState().projects.length
  const skipped =
    found.skipped > 0
      ? ` ${count(found.skipped, 'entry', 'entries')} in the file could not be read and will be skipped.`
      : ''
  useAppStore.getState().requestConfirm({
    title: 'Restore from backup?',
    body: `This replaces everything saved in this browser (${count(current, 'project', 'projects')}) with the backup's ${count(found.projects, 'project', 'projects')} and ${count(found.items, 'work package', 'work packages')}.${skipped} Download a backup first if you want to keep the current data.`,
    confirmLabel: 'Replace my data',
    tone: 'danger',
    onConfirm: async () => {
      try {
        await api.data.restoreBackup(text)
      } catch (err: unknown) {
        toast.error(`Couldn't restore the backup: ${errorMessage(err)}`)
        throw err
      }
      await useCostStore.getState().fetchInitialData()
      toast.success(`Restored ${count(found.projects, 'project', 'projects')} from the backup`)
    }
  })
}

/**
 * Opens the browser's file picker for a backup, for callers that have no file
 * input of their own (the command menu). Must run inside a click or key press.
 */
export function chooseBackupFile(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) restoreBackupFile(file)
  })
  input.click()
}

export function confirmResetDemo(): void {
  const current = useCostStore.getState().projects.length
  useAppStore.getState().requestConfirm({
    title: 'Reset to the demo data?',
    body: `This deletes everything saved in this browser (${count(current, 'project', 'projects')}) and brings back the demo project. Download a backup first if you want to keep it.`,
    confirmLabel: 'Reset demo data',
    tone: 'danger',
    onConfirm: async () => {
      try {
        await api.data.resetToDemo()
      } catch (err: unknown) {
        toast.error(`Couldn't reset the data: ${errorMessage(err)}`)
        throw err
      }
      await useCostStore.getState().fetchInitialData()
      toast.success('Demo data restored')
    }
  })
}
