import React, { useId, useRef, useState } from 'react'
import { ChevronDown, Download, HardDrive, RotateCcw, Upload } from 'lucide-react'
import { useCostStore } from '../store/useCostStore'
import { cn } from '../lib/utils'
import { confirmResetDemo, downloadBackup, restoreBackupFile } from './dataActions'

/**
 * Says where the data is being saved: in this browser's storage. Also holds the
 * web-only data tools: download a backup, restore one, and reset to the demo.
 */
export const DataSourceStatus: React.FC = () => {
  const mode = useCostStore((s) => s.mode)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuId = useId()

  if (mode === 'unknown') {
    return <div className="skeleton h-8 w-full" aria-label="Loading your data" />
  }

  const action =
    'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-small text-ink-2 transition-colors hover:bg-subtle hover:text-ink'

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-small text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
        title="Data is kept in this browser's storage on this device"
      >
        <HardDrive className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span className="font-medium">Saved in this browser</span>
        <ChevronDown
          className={cn(
            'ml-auto size-4 text-ink-3 transition-transform duration-150',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div id={menuId} className="flex flex-col gap-px pb-1 animate-fade-in">
          <p className="px-2.5 pb-1 text-caption text-ink-3">
            Only on this device. Download a backup to move it or keep it safe.
          </p>
          <button type="button" onClick={downloadBackup} className={action}>
            <Download className="size-4 text-ink-3" aria-hidden />
            Download backup
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={action}>
            <Upload className="size-4 text-ink-3" aria-hidden />
            Restore from backup…
          </button>
          <button
            type="button"
            onClick={confirmResetDemo}
            className={cn(action, 'text-bad hover:bg-bad-bg hover:text-bad')}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset demo data…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Backup file to restore"
            data-testid="restore-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) restoreBackupFile(file)
            }}
          />
        </div>
      )}
    </div>
  )
}
