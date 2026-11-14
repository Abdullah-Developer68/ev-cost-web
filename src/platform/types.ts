/**
 * The data contract between the UI and the platform. It matches the desktop
 * preload contract (`EV-COST/src/preload/index.d.ts`) minus the desktop-only
 * `revealStorage`, so the stores are identical in both projects.
 */

export interface WorkPackageItem {
  id: number
  projectId: number
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes: string | null
  createdAt: Date | string | null
}

export interface Project {
  id: number
  name: string
  description: string | null
  currency: string
  createdAt: Date | string | null
}

export interface InitResult {
  projects: Project[]
  activeProject: Project
  items: WorkPackageItem[]
  /** 'online' = a cloud database; 'local' = saved on this device. The web app is always 'local'. */
  mode: 'online' | 'local'
  /** Why a configured cloud database is not in use. Always null on the web. */
  offlineReason: string | null
  /** Full path of a local data file. Always null on the web. */
  storagePath: string | null
  /** A one-time message about how saved data was loaded, to show the user. */
  notice: string | null
}

export interface WorkPackageValues {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes?: string
}

export interface CostApi {
  init: () => Promise<InitResult>
  createProject: (data: {
    name: string
    description?: string
    currency?: string
  }) => Promise<Project>
  updateProject: (data: {
    id: number
    name: string
    description?: string
    currency?: string
  }) => Promise<Project>
  deleteProject: (id: number) => Promise<{ success: boolean; id: number }>
  selectProject: (projectId: number) => Promise<WorkPackageItem[]>
  addItem: (data: WorkPackageValues & { projectId: number }) => Promise<WorkPackageItem>
  updateItem: (data: WorkPackageValues & { id: number }) => Promise<WorkPackageItem>
  deleteItem: (id: number) => Promise<{ success: boolean; id: number }>
  bulkImport: (payload: {
    projectId: number
    items: WorkPackageValues[]
  }) => Promise<WorkPackageItem[]>
}

/** Web-only: whole-workbook backup, restore, reset and cross-tab sync. */
export interface BrowserDataApi {
  /** Everything saved, as pretty-printed JSON ready to download. */
  exportBackup: () => string
  /** Validates a backup file's text without applying it. Throws a readable error when invalid. */
  inspectBackup: (text: string) => { projects: number; items: number; skipped: number }
  /** Replaces all saved data with the backup. Throws (and changes nothing) when invalid. */
  restoreBackup: (text: string) => Promise<void>
  /** Replaces all saved data with the demo project. */
  resetToDemo: () => Promise<void>
  /**
   * Re-reads storage after another tab wrote to it. Returns true when the saved
   * data actually changed. `key` is the `StorageEvent.key` (null = storage cleared).
   */
  reloadFromStorage: (key: string | null) => boolean
}

export interface CustomApi {
  costs: CostApi
  data: BrowserDataApi
}
