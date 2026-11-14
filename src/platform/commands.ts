import { Download, RotateCcw, Upload } from 'lucide-react'
import type { Command } from '../lib/commands'
import { confirmResetDemo, chooseBackupFile, downloadBackup } from './dataActions'
import { pageShortcutLabel } from './shortcuts'

/** How the page shortcuts are written on this platform: plain 1 … 4 in the browser. */
export const pageShortcut = pageShortcutLabel

const DATA_COMMANDS: Command[] = [
  {
    id: 'data-backup',
    group: 'Data',
    label: 'Download a backup',
    icon: Download,
    keywords: 'export save json browser storage copy',
    run: downloadBackup
  },
  {
    id: 'data-restore',
    group: 'Data',
    label: 'Restore from a backup',
    icon: Upload,
    keywords: 'import load json browser storage',
    run: chooseBackupFile
  },
  {
    id: 'data-reset',
    group: 'Data',
    label: 'Reset to the demo data',
    icon: RotateCcw,
    keywords: 'clear delete wipe start over sample',
    run: confirmResetDemo
  }
]

/** Command-menu entries that only make sense in the browser: the backup tools. */
export function usePlatformCommands(): Command[] {
  return DATA_COMMANDS
}
