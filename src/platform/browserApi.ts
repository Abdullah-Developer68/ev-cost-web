import { DEMO_ITEMS, DEMO_PROJECT } from './demoData'
import {
  assertId,
  normalizeProject,
  normalizeWorkPackage,
  NormalizedWorkPackage,
  ProjectInput,
  WorkPackageInput
} from './normalize'
import type { CustomApi, InitResult, Project, WorkPackageItem } from './types'

/** The one localStorage key that holds every project and work package. */
export const STORAGE_KEY = 'ev-cost:data:v1'
/** Prefix for copies of saved data that could not be read, kept for the user to recover. */
export const UNREADABLE_PREFIX = 'ev-cost:data:unreadable:'

/** Imports larger than this are cut off, as on the desktop. */
const MAX_IMPORT_ROWS = 5000

interface StoredProject {
  id: number
  name: string
  description: string | null
  currency: string
  createdAt: string | null
}

interface StoredItem extends NormalizedWorkPackage {
  id: number
  projectId: number
  createdAt: string | null
}

interface StoredData {
  version: 1
  projects: StoredProject[]
  items: StoredItem[]
  nextProjectId: number
  nextItemId: number
}

interface BackupFile extends StoredData {
  app: 'ev-cost'
  exportedAt: string
}

type ProjectValues = { name: string; description: string; currency: string }

const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null && !Array.isArray(val)

const isId = (val: unknown): val is number => Number.isInteger(val) && (val as number) > 0

const isoOrNull = (val: unknown): string | null =>
  typeof val === 'string' && !Number.isNaN(Date.parse(val)) ? val : null

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** Thrown for data that is not EV-COST data at all (bad JSON, wrong shape). */
class UnreadableDataError extends Error {}

/**
 * Validates and normalises a stored blob or a backup file. Entries that cannot
 * be read are skipped and counted; ids are never reused, even when the stored
 * counters are missing or behind.
 */
function parseData(text: string): { data: StoredData; skipped: number } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new UnreadableDataError('The data is not valid JSON')
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.projects) || !Array.isArray(parsed.items)) {
    throw new UnreadableDataError('The data is not an EV-COST workbook')
  }
  if (parsed.version !== undefined && parsed.version !== 1) {
    throw new UnreadableDataError(`The data is from an unsupported version (${parsed.version})`)
  }

  let skipped = 0
  const projects: StoredProject[] = []
  const projectIds = new Set<number>()
  for (const raw of parsed.projects) {
    if (!isRecord(raw) || !isId(raw.id) || projectIds.has(raw.id)) {
      skipped += 1
      continue
    }
    projectIds.add(raw.id)
    projects.push({
      id: raw.id,
      ...normalizeProject(raw as ProjectInput),
      createdAt: isoOrNull(raw.createdAt)
    })
  }

  const items: StoredItem[] = []
  const itemIds = new Set<number>()
  for (const raw of parsed.items) {
    if (
      !isRecord(raw) ||
      !isId(raw.id) ||
      itemIds.has(raw.id) ||
      !isId(raw.projectId) ||
      !projectIds.has(raw.projectId)
    ) {
      skipped += 1
      continue
    }
    itemIds.add(raw.id)
    items.push({
      id: raw.id,
      projectId: raw.projectId,
      ...normalizeWorkPackage(raw as Partial<WorkPackageInput>),
      createdAt: isoOrNull(raw.createdAt)
    })
  }

  const nextAfter = (ids: Set<number>, stored: unknown): number =>
    Math.max(isId(stored) ? stored : 1, ...[...ids].map((id) => id + 1))

  return {
    data: {
      version: 1,
      projects,
      items,
      nextProjectId: nextAfter(projectIds, parsed.nextProjectId),
      nextItemId: nextAfter(itemIds, parsed.nextItemId)
    },
    skipped
  }
}

/** A change that could not be written to storage, so it was not applied. */
export class StorageWriteError extends Error {
  override name = 'StorageWriteError'
}

/** Turns a storage exception into a sentence a user can act on. */
export function describeStorageError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return "This browser's storage for EV-COST is full, so the change was not saved"
  }
  if (name === 'SecurityError') {
    return 'This browser is blocking site storage, so the change was not saved'
  }
  const message = err instanceof Error ? err.message : String(err)
  return `The change could not be saved in this browser (${message})`
}

/**
 * A Storage that cannot hold anything, for browsers that block localStorage
 * outright. Reads come back empty and every write fails with a SecurityError.
 */
export function unavailableStorage(): Storage {
  const refuse = (): never => {
    const err = new Error('Site storage is blocked')
    err.name = 'SecurityError'
    throw err
  }
  return {
    length: 0,
    clear: refuse,
    getItem: () => null,
    key: () => null,
    removeItem: refuse,
    setItem: refuse
  }
}

/**
 * The whole data layer of the web app: every `CostApi` method, implemented on
 * one versioned localStorage key. It stands in for the desktop's main process,
 * so it normalises every write itself (formula-injection stripping, clamping,
 * id checks) and validates everything it reads back.
 *
 * A change is written first and applied in memory only once the write has
 * succeeded, so a full or blocked storage rejects the call and leaves the data
 * exactly as it was.
 */
export function createBrowserApi(storage: Storage, now: () => Date = () => new Date()): CustomApi {
  let data: StoredData | null = null
  /** The exact text last read from or written to storage, to notice other tabs' writes. */
  let lastRaw: string | null = null
  let notice: string | null = null

  const addNotice = (message: string): void => {
    notice = notice ? `${notice} ${message}` : message
  }

  const write = (next: StoredData): void => {
    const raw = JSON.stringify(next)
    try {
      storage.setItem(STORAGE_KEY, raw)
    } catch (err) {
      throw new StorageWriteError(describeStorageError(err), { cause: err })
    }
    lastRaw = raw
  }

  const commit = (next: StoredData): void => {
    write(next)
    data = next
  }

  /** The demo project added on top of whatever ids were already handed out. */
  const seeded = (base?: StoredData | null): StoredData => {
    const projectId = base?.nextProjectId ?? 1
    const firstItemId = base?.nextItemId ?? 1
    const createdAt = now().toISOString()
    return {
      version: 1,
      projects: [{ id: projectId, ...DEMO_PROJECT, createdAt }],
      items: DEMO_ITEMS.map((item, index) => ({
        ...item,
        id: firstItemId + index,
        projectId,
        createdAt
      })),
      nextProjectId: projectId + 1,
      nextItemId: firstItemId + DEMO_ITEMS.length
    }
  }

  /** Writes data the app must have to start; if storage refuses, it still runs for this session. */
  const persistOrKeep = (next: StoredData): StoredData => {
    try {
      write(next)
    } catch (err) {
      addNotice(
        `Changes can't be saved in this browser yet: ${describeStorageError(err).replace(/, so the change was not saved$/, '')}.`
      )
    }
    return next
  }

  /** Keeps the unreadable blob under another key and starts again from the demo project. */
  const recover = (raw: string, previous: StoredData | null): StoredData => {
    const backupKey = `${UNREADABLE_PREFIX}${now().toISOString()}`
    let kept = false
    try {
      storage.setItem(backupKey, raw)
      kept = true
    } catch {
      // No room for the copy; the demo data below replaces the unreadable blob anyway.
    }
    const fresh = persistOrKeep(seeded(previous))
    addNotice(
      'The data saved in this browser could not be read, so EV-COST started again from the demo project.' +
        (kept ? ` The old data was kept under the storage key "${backupKey}".` : '')
    )
    return fresh
  }

  /** Reads storage into memory, recovering from anything unreadable. */
  const load = (): StoredData => {
    let raw: string | null
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      raw = null
    }
    if (raw === null) {
      lastRaw = null
      return persistOrKeep(seeded(data))
    }
    try {
      const { data: parsed, skipped } = parseData(raw)
      lastRaw = raw
      if (skipped > 0) {
        addNotice(
          `${skipped} ${plural(skipped, 'entry', 'entries')} in the data saved in this browser could not be read and ${plural(skipped, 'was', 'were')} skipped.`
        )
      }
      // Counters never go backwards, even if another tab wrote older ones.
      if (data) {
        parsed.nextProjectId = Math.max(parsed.nextProjectId, data.nextProjectId)
        parsed.nextItemId = Math.max(parsed.nextItemId, data.nextItemId)
      }
      return parsed
    } catch {
      return recover(raw, data)
    }
  }

  /** The current data, re-read first if another tab has written since we last looked. */
  const current = (): StoredData => {
    if (data === null) {
      data = load()
      return data
    }
    let raw: string | null = lastRaw
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      // Storage unreadable now: keep working from memory.
    }
    if (raw !== lastRaw) data = load()
    return data
  }

  const copyProject = (p: StoredProject): Project => ({ ...p })
  const copyItem = (i: StoredItem): WorkPackageItem => ({ ...i })
  const itemsFor = (d: StoredData, projectId: number): WorkPackageItem[] =>
    d.items.filter((i) => i.projectId === projectId).map(copyItem)

  const insertItems = (projectId: number, rows: NormalizedWorkPackage[]): WorkPackageItem[] => {
    const d = current()
    if (!d.projects.some((p) => p.id === projectId)) throw new Error('Project not found')
    if (rows.length === 0) return []
    const createdAt = now().toISOString()
    const inserted: StoredItem[] = rows.map((row, index) => ({
      id: d.nextItemId + index,
      projectId,
      ...row,
      createdAt
    }))
    commit({
      ...d,
      items: [...d.items, ...inserted],
      nextItemId: d.nextItemId + inserted.length
    })
    return inserted.map(copyItem)
  }

  /** Runs a synchronous operation as a promise, so errors become rejections. */
  const run = <T>(fn: () => T): Promise<T> => {
    try {
      return Promise.resolve(fn())
    } catch (err) {
      return Promise.reject(err)
    }
  }

  const parseBackup = (text: string): { data: StoredData; skipped: number } => {
    let parsed: { data: StoredData; skipped: number }
    try {
      parsed = parseData(text)
    } catch (err) {
      const reason = err instanceof Error ? err.message.replace(/^The data/, 'The file') : ''
      throw new Error(`This is not an EV-COST backup. ${reason}.`, { cause: err })
    }
    if (parsed.data.projects.length === 0) {
      throw new Error('This backup has no projects in it, so there is nothing to restore.')
    }
    return parsed
  }

  return {
    costs: {
      init: () =>
        run((): InitResult => {
          let d = current()
          if (d.projects.length === 0) {
            d = persistOrKeep(seeded(d))
            data = d
          }
          const activeProject = d.projects[0]
          const result: InitResult = {
            projects: d.projects.map(copyProject),
            activeProject: copyProject(activeProject),
            items: itemsFor(d, activeProject.id),
            mode: 'local',
            offlineReason: null,
            storagePath: null,
            notice
          }
          notice = null
          return result
        }),

      createProject: (input) =>
        run(() => {
          const values: ProjectValues = normalizeProject(input)
          const d = current()
          const project: StoredProject = {
            id: d.nextProjectId,
            ...values,
            createdAt: now().toISOString()
          }
          commit({ ...d, projects: [project, ...d.projects], nextProjectId: project.id + 1 })
          return copyProject(project)
        }),

      updateProject: (input) =>
        run(() => {
          const id = assertId(input?.id, 'project id')
          const values = normalizeProject(input)
          const d = current()
          const existing = d.projects.find((p) => p.id === id)
          if (!existing) throw new Error('Project not found')
          const updated = { ...existing, ...values }
          commit({ ...d, projects: d.projects.map((p) => (p.id === id ? updated : p)) })
          return copyProject(updated)
        }),

      deleteProject: (rawId) =>
        run(() => {
          const id = assertId(rawId, 'project id')
          const d = current()
          commit({
            ...d,
            projects: d.projects.filter((p) => p.id !== id),
            items: d.items.filter((i) => i.projectId !== id)
          })
          return { success: true, id }
        }),

      selectProject: (rawId) =>
        run(() => {
          const projectId = assertId(rawId, 'project id')
          return itemsFor(current(), projectId)
        }),

      addItem: (input) =>
        run(() => {
          const projectId = assertId(input?.projectId, 'project id')
          return insertItems(projectId, [normalizeWorkPackage(input)])[0]
        }),

      updateItem: (input) =>
        run(() => {
          const id = assertId(input?.id, 'work package id')
          const values = normalizeWorkPackage(input)
          const d = current()
          const existing = d.items.find((i) => i.id === id)
          if (!existing) throw new Error('Work package not found')
          const updated = { ...existing, ...values }
          commit({ ...d, items: d.items.map((i) => (i.id === id ? updated : i)) })
          return copyItem(updated)
        }),

      deleteItem: (rawId) =>
        run(() => {
          const id = assertId(rawId, 'work package id')
          const d = current()
          commit({ ...d, items: d.items.filter((i) => i.id !== id) })
          return { success: true, id }
        }),

      bulkImport: (payload) =>
        run(() => {
          const projectId = assertId(payload?.projectId, 'project id')
          const rows = Array.isArray(payload?.items) ? payload.items.slice(0, MAX_IMPORT_ROWS) : []
          const values = rows.map((row) => normalizeWorkPackage(row, 'Imported Work Package'))
          return insertItems(projectId, values)
        })
    },

    data: {
      exportBackup: () => {
        const d = current()
        const backup: BackupFile = { app: 'ev-cost', exportedAt: now().toISOString(), ...d }
        return JSON.stringify(backup, null, 2)
      },

      inspectBackup: (text) => {
        const { data: parsed, skipped } = parseBackup(text)
        return { projects: parsed.projects.length, items: parsed.items.length, skipped }
      },

      restoreBackup: (text) =>
        run(() => {
          const { data: parsed } = parseBackup(text)
          const d = current()
          // Ids handed out before the restore are never handed out again.
          commit({
            ...parsed,
            nextProjectId: Math.max(parsed.nextProjectId, d.nextProjectId),
            nextItemId: Math.max(parsed.nextItemId, d.nextItemId)
          })
        }),

      resetToDemo: () =>
        run(() => {
          commit(seeded(current()))
        }),

      reloadFromStorage: (key) => {
        if (key !== null && key !== STORAGE_KEY) return false
        if (data === null) return false
        let raw: string | null = lastRaw
        try {
          raw = storage.getItem(STORAGE_KEY)
        } catch {
          return false
        }
        // Nothing to do when storage still holds exactly what this tab last saw.
        if (raw === lastRaw) return false
        data = load()
        return true
      }
    }
  }
}
