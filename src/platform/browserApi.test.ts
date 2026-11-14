import { describe, it, expect, beforeEach } from 'vitest'
import { createBrowserApi, STORAGE_KEY, UNREADABLE_PREFIX, unavailableStorage } from './browserApi'
import { DEMO_ITEMS, DEMO_PROJECT } from './demoData'
import type { CustomApi } from './types'

/** An in-memory Storage that can be told to refuse writes, like a full or blocked localStorage. */
class FakeStorage implements Storage {
  map = new Map<string, string>()
  failWrites: false | 'quota' | 'security' = false
  writes = 0

  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) {
      const err = new Error('refused')
      err.name = this.failWrites === 'quota' ? 'QuotaExceededError' : 'SecurityError'
      throw err
    }
    this.writes += 1
    this.map.set(key, String(value))
  }
}

const fixedNow = (): Date => new Date('2026-11-11T09:00:00.000Z')

const pkg = {
  taskName: 'Design review',
  category: 'QA',
  bac: 1000,
  plannedPercent: 50,
  actualPercent: 40,
  actualCost: 500,
  notes: 'first pass'
}

function stored(storage: FakeStorage): {
  projects: Array<{ id: number }>
  items: Array<{ id: number; projectId: number; taskName: string }>
  nextProjectId: number
  nextItemId: number
} {
  return JSON.parse(storage.getItem(STORAGE_KEY)!)
}

describe('createBrowserApi', () => {
  let storage: FakeStorage
  let api: CustomApi

  beforeEach(() => {
    storage = new FakeStorage()
    api = createBrowserApi(storage, fixedNow)
  })

  describe('first run', () => {
    it('seeds and saves the demo project with its five work packages', async () => {
      const data = await api.costs.init()
      expect(data.mode).toBe('local')
      expect(data.offlineReason).toBeNull()
      expect(data.storagePath).toBeNull()
      expect(data.notice).toBeNull()
      expect(data.projects).toHaveLength(1)
      expect(data.activeProject).toMatchObject({ id: 1, ...DEMO_PROJECT })
      expect(data.items).toHaveLength(DEMO_ITEMS.length)
      expect(data.items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5])
      expect(data.items[0]).toMatchObject({ ...DEMO_ITEMS[0], projectId: 1 })
      expect(stored(storage)).toMatchObject({ version: 1, nextProjectId: 2, nextItemId: 6 })
    })

    it('loads saved data instead of seeding again', async () => {
      await api.costs.init()
      await api.costs.addItem({ projectId: 1, ...pkg })
      const reopened = createBrowserApi(storage, fixedNow)
      const data = await reopened.costs.init()
      expect(data.items).toHaveLength(6)
      expect(data.items[5]).toMatchObject({ id: 6, taskName: 'Design review' })
    })

    it('seeds again when every project was deleted', async () => {
      await api.costs.init()
      await api.costs.deleteProject(1)
      const data = await api.costs.init()
      expect(data.projects).toHaveLength(1)
      expect(data.activeProject.id).toBe(2) // ids are never reused
      expect(data.items.map((i) => i.id)).toEqual([6, 7, 8, 9, 10])
    })
  })

  describe('projects', () => {
    beforeEach(async () => {
      await api.costs.init()
    })

    it('creates a project first in the list, with the next id', async () => {
      const project = await api.costs.createProject({ name: 'Second', currency: '€' })
      expect(project).toMatchObject({ id: 2, name: 'Second', description: '', currency: '€' })
      expect(project.createdAt).toBe('2026-11-11T09:00:00.000Z')
      const data = await api.costs.init()
      expect(data.projects.map((p) => p.id)).toEqual([2, 1])
    })

    it('updates a project', async () => {
      const updated = await api.costs.updateProject({ id: 1, name: 'Renamed', currency: 'Rs ' })
      expect(updated).toMatchObject({ id: 1, name: 'Renamed', currency: 'Rs ' })
      expect((await api.costs.init()).projects[0].name).toBe('Renamed')
    })

    it('rejects updating a project that does not exist', async () => {
      await expect(api.costs.updateProject({ id: 99, name: 'x' })).rejects.toThrow(
        'Project not found'
      )
    })

    it('deletes a project together with its work packages', async () => {
      const second = await api.costs.createProject({ name: 'Second' })
      await api.costs.addItem({ projectId: second.id, ...pkg })
      await expect(api.costs.deleteProject(1)).resolves.toEqual({ success: true, id: 1 })
      expect(await api.costs.selectProject(1)).toEqual([])
      expect(stored(storage).items.map((i) => i.projectId)).toEqual([2])
    })

    it('selects a project and returns only its work packages', async () => {
      const second = await api.costs.createProject({ name: 'Second' })
      await api.costs.addItem({ projectId: second.id, ...pkg })
      const items = await api.costs.selectProject(second.id)
      expect(items).toHaveLength(1)
      expect(items[0].projectId).toBe(second.id)
    })
  })

  describe('work packages', () => {
    beforeEach(async () => {
      await api.costs.init()
    })

    it('adds a work package with the next id', async () => {
      const item = await api.costs.addItem({ projectId: 1, ...pkg })
      expect(item).toMatchObject({ id: 6, projectId: 1, ...pkg })
      expect(stored(storage).nextItemId).toBe(7)
    })

    it('rejects adding to a project that does not exist', async () => {
      await expect(api.costs.addItem({ projectId: 42, ...pkg })).rejects.toThrow(
        'Project not found'
      )
    })

    it('updates a work package', async () => {
      const updated = await api.costs.updateItem({ id: 2, ...pkg, actualCost: 900 })
      expect(updated).toMatchObject({ id: 2, projectId: 1, actualCost: 900 })
      expect(stored(storage).items.find((i) => i.id === 2)?.taskName).toBe('Design review')
    })

    it('rejects updating a work package that does not exist', async () => {
      await expect(api.costs.updateItem({ id: 77, ...pkg })).rejects.toThrow(
        'Work package not found'
      )
    })

    it('deletes a work package', async () => {
      await expect(api.costs.deleteItem(3)).resolves.toEqual({ success: true, id: 3 })
      expect((await api.costs.selectProject(1)).map((i) => i.id)).toEqual([1, 2, 4, 5])
    })

    it('bulk imports rows with consecutive ids and the import fallback name', async () => {
      const rows = await api.costs.bulkImport({
        projectId: 1,
        items: [pkg, { ...pkg, taskName: '' }]
      })
      expect(rows.map((r) => r.id)).toEqual([6, 7])
      expect(rows[1].taskName).toBe('Imported Work Package')
      expect(await api.costs.bulkImport({ projectId: 1, items: [] })).toEqual([])
    })

    it('never reuses an id after a delete, even across reloads', async () => {
      await api.costs.deleteItem(5)
      const added = await api.costs.addItem({ projectId: 1, ...pkg })
      expect(added.id).toBe(6)
      await api.costs.deleteItem(6)
      const reopened = createBrowserApi(storage, fixedNow)
      await reopened.costs.init()
      expect((await reopened.costs.addItem({ projectId: 1, ...pkg })).id).toBe(7)
    })

    it('rejects invalid ids', async () => {
      await expect(api.costs.deleteItem(0)).rejects.toThrow('Invalid work package id')
      await expect(api.costs.deleteProject(-1)).rejects.toThrow('Invalid project id')
      await expect(api.costs.selectProject(1.5)).rejects.toThrow('Invalid project id')
      await expect(
        api.costs.addItem({ ...pkg, projectId: 'x' as unknown as number })
      ).rejects.toThrow('Invalid project id')
    })
  })

  describe('normalisation on write', () => {
    beforeEach(async () => {
      await api.costs.init()
    })

    it('strips formula-injection prefixes and clamps numbers', async () => {
      const item = await api.costs.addItem({
        projectId: 1,
        taskName: '=HYPERLINK("http://evil")',
        category: '  +cmd',
        bac: -50,
        plannedPercent: 140,
        actualPercent: Number.NaN,
        actualCost: '300' as unknown as number,
        notes: '@SUM(A1)'
      })
      expect(item).toMatchObject({
        taskName: 'HYPERLINK("http://evil")',
        category: 'cmd',
        bac: 0,
        plannedPercent: 100,
        actualPercent: 0,
        actualCost: 300,
        notes: 'SUM(A1)'
      })
      expect(stored(storage).items.at(-1)?.taskName).toBe('HYPERLINK("http://evil")')
    })

    it('normalises project names and currencies', async () => {
      const project = await api.costs.createProject({
        name: '-=Payroll',
        description: '+note',
        currency: '<script>'
      })
      expect(project).toMatchObject({ name: 'Payroll', description: 'note', currency: '$' })
    })

    it('normalises every bulk-imported row', async () => {
      const [row] = await api.costs.bulkImport({
        projectId: 1,
        items: [{ ...pkg, taskName: '=1+1', bac: -1, actualPercent: 300 }]
      })
      expect(row).toMatchObject({ taskName: '1+1', bac: 0, actualPercent: 100 })
    })
  })

  describe('a write that fails', () => {
    beforeEach(async () => {
      await api.costs.init()
    })

    it.each(['quota', 'security'] as const)(
      'rejects with a readable message and changes nothing (%s)',
      async (failure) => {
        const before = storage.getItem(STORAGE_KEY)
        storage.failWrites = failure
        const message =
          failure === 'quota' ? /storage for EV-COST is full/ : /blocking site storage/
        await expect(api.costs.addItem({ projectId: 1, ...pkg })).rejects.toThrow(message)
        await expect(api.costs.updateItem({ id: 1, ...pkg })).rejects.toThrow(message)
        await expect(api.costs.deleteItem(1)).rejects.toThrow(message)
        await expect(api.costs.createProject({ name: 'x' })).rejects.toThrow(message)
        await expect(api.costs.deleteProject(1)).rejects.toThrow(message)
        await expect(api.costs.bulkImport({ projectId: 1, items: [pkg] })).rejects.toThrow(message)
        await expect(api.data.resetToDemo()).rejects.toThrow(message)

        // Neither storage nor the in-memory state moved.
        expect(storage.getItem(STORAGE_KEY)).toBe(before)
        const items = await api.costs.selectProject(1)
        expect(items).toHaveLength(5)
        expect(items[0].taskName).toBe(DEMO_ITEMS[0].taskName)

        // And the next id was not consumed by the failed attempts.
        storage.failWrites = false
        expect((await api.costs.addItem({ projectId: 1, ...pkg })).id).toBe(6)
      }
    )

    it('still starts when storage is blocked outright, and says so', async () => {
      const blocked = createBrowserApi(unavailableStorage(), fixedNow)
      const data = await blocked.costs.init()
      expect(data.items).toHaveLength(5)
      expect(data.notice).toMatch(/can't be saved in this browser/)
      await expect(blocked.costs.addItem({ projectId: 1, ...pkg })).rejects.toThrow(
        /blocking site storage/
      )
    })
  })

  describe('reading saved data', () => {
    it.each([
      ['not JSON', '{"projects": ['],
      ['the wrong shape', '{"hello": "world"}'],
      ['an array', '[1, 2, 3]'],
      ['an unknown version', '{"version": 9, "projects": [], "items": []}']
    ])('recovers from %s: keeps the blob and starts from the demo', async (_, blob) => {
      storage.map.set(STORAGE_KEY, blob)
      const data = await createBrowserApi(storage, fixedNow).costs.init()
      expect(data.projects[0].name).toBe(DEMO_PROJECT.name)
      expect(data.items).toHaveLength(5)
      expect(data.notice).toMatch(/could not be read, so EV-COST started again/)
      const backupKey = `${UNREADABLE_PREFIX}2026-11-11T09:00:00.000Z`
      expect(data.notice).toContain(backupKey)
      expect(storage.getItem(backupKey)).toBe(blob)
      expect(stored(storage).projects).toHaveLength(1)
    })

    it('shows the recovery notice once', async () => {
      storage.map.set(STORAGE_KEY, 'garbage')
      const fresh = createBrowserApi(storage, fixedNow)
      expect((await fresh.costs.init()).notice).not.toBeNull()
      expect((await fresh.costs.init()).notice).toBeNull()
    })

    it('skips unreadable entries, normalises the rest and counts them', async () => {
      storage.map.set(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          projects: [
            { id: 3, name: '=Kept', currency: '€', createdAt: 'not a date' },
            { id: 3, name: 'Duplicate id' },
            { id: 'x', name: 'Bad id' },
            null
          ],
          items: [
            { id: 10, projectId: 3, taskName: 'Ok', bac: '500', plannedPercent: 900 },
            { id: 10, projectId: 3, taskName: 'Duplicate' },
            { id: 11, projectId: 99, taskName: 'Orphan' },
            'nonsense'
          ],
          nextProjectId: 1,
          nextItemId: 2
        })
      )
      const reopened = createBrowserApi(storage, fixedNow)
      const data = await reopened.costs.init()
      expect(data.projects).toEqual([
        { id: 3, name: 'Kept', description: '', currency: '€', createdAt: null }
      ])
      expect(data.items).toHaveLength(1)
      expect(data.items[0]).toMatchObject({ id: 10, bac: 500, plannedPercent: 100 })
      expect(data.notice).toBe(
        '6 entries in the data saved in this browser could not be read and were skipped.'
      )
      // Counters that were behind are moved past the highest id in use.
      expect((await reopened.costs.createProject({ name: 'New' })).id).toBe(4)
      expect((await reopened.costs.addItem({ projectId: 3, ...pkg })).id).toBe(11)
    })

    it('picks up a write from another tab before its own next write', async () => {
      await api.costs.init()
      const otherTab = createBrowserApi(storage, fixedNow)
      await otherTab.costs.init()
      await otherTab.costs.addItem({ projectId: 1, ...pkg, taskName: 'From the other tab' })

      // This tab writes next: it must not overwrite the other tab's work package or reuse its id.
      const mine = await api.costs.addItem({ projectId: 1, ...pkg, taskName: 'From this tab' })
      expect(mine.id).toBe(7)
      expect(
        stored(storage)
          .items.map((i) => i.taskName)
          .slice(-2)
      ).toEqual(['From the other tab', 'From this tab'])
    })

    it('reports whether a storage event changed anything', async () => {
      await api.costs.init()
      expect(api.data.reloadFromStorage('ev-cost:theme')).toBe(false)
      expect(api.data.reloadFromStorage(STORAGE_KEY)).toBe(false)
      const otherTab = createBrowserApi(storage, fixedNow)
      await otherTab.costs.deleteItem(1)
      expect(api.data.reloadFromStorage(STORAGE_KEY)).toBe(true)
      expect(await api.costs.selectProject(1)).toHaveLength(4)
    })
  })

  describe('backup, restore and reset', () => {
    beforeEach(async () => {
      await api.costs.init()
    })

    it('round-trips every project and work package through a backup file', async () => {
      const second = await api.costs.createProject({ name: 'Second', currency: '€' })
      await api.costs.addItem({ projectId: second.id, ...pkg })
      const backup = api.data.exportBackup()
      const parsed = JSON.parse(backup)
      expect(parsed).toMatchObject({
        app: 'ev-cost',
        version: 1,
        exportedAt: fixedNow().toISOString()
      })
      expect(api.data.inspectBackup(backup)).toEqual({ projects: 2, items: 6, skipped: 0 })

      // Restore into a brand-new browser profile.
      const otherStorage = new FakeStorage()
      const other = createBrowserApi(otherStorage, fixedNow)
      await other.costs.init()
      await other.data.restoreBackup(backup)
      const restored = await other.costs.init()
      expect(restored.projects).toEqual((await api.costs.init()).projects)
      expect(await other.costs.selectProject(second.id)).toEqual(
        await api.costs.selectProject(second.id)
      )
      expect(await other.costs.selectProject(1)).toEqual(await api.costs.selectProject(1))
    })

    it('keeps handing out new ids after a restore of older data', async () => {
      const backup = api.data.exportBackup() // nextItemId 6
      await api.costs.addItem({ projectId: 1, ...pkg }) // id 6
      await api.costs.addItem({ projectId: 1, ...pkg }) // id 7
      await api.data.restoreBackup(backup)
      expect((await api.costs.addItem({ projectId: 1, ...pkg })).id).toBe(8)
    })

    it.each([
      ['not JSON', 'nope', /not an EV-COST backup/],
      ['the wrong shape', '{"a":1}', /not an EV-COST backup/],
      ['no projects', '{"projects":[],"items":[]}', /no projects/]
    ])('refuses a backup that is %s and changes nothing', async (_, text, message) => {
      const before = storage.getItem(STORAGE_KEY)
      expect(() => api.data.inspectBackup(text)).toThrow(message)
      await expect(api.data.restoreBackup(text)).rejects.toThrow(message)
      expect(storage.getItem(STORAGE_KEY)).toBe(before)
    })

    it('normalises what it restores', async () => {
      const text = JSON.stringify({
        projects: [{ id: 1, name: '@Evil', currency: '$' }],
        items: [{ id: 1, projectId: 1, taskName: '=cmd', bac: -10 }]
      })
      await api.data.restoreBackup(text)
      const data = await api.costs.init()
      expect(data.activeProject.name).toBe('Evil')
      expect(data.items[0]).toMatchObject({ taskName: 'cmd', bac: 0 })
    })

    it('resets to the demo project with fresh ids', async () => {
      await api.costs.createProject({ name: 'Mine' })
      await api.data.resetToDemo()
      const data = await api.costs.init()
      expect(data.projects).toHaveLength(1)
      expect(data.activeProject).toMatchObject({ id: 3, name: DEMO_PROJECT.name })
      expect(data.items.map((i) => i.id)).toEqual([6, 7, 8, 9, 10])
    })
  })
})
