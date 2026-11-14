import { create } from 'zustand'
import { Project, WorkPackageItem } from '../types'
import type { HealthLevel } from '../lib/calculations'
import { useAppStore } from './useAppStore'
import { errorMessage, toast, useToastStore } from './useToastStore'
import { api } from '../platform/api'

export type WorkPackageDraft = {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes?: string
}

/** 'online' = the cloud database; 'local' = saved on this device. */
export type DataMode = 'online' | 'local' | 'unknown'
export type HealthFilter = 'ALL' | HealthLevel

interface CostState {
  projects: Project[]
  activeProjectId: number | null
  items: WorkPackageItem[]
  searchQuery: string
  categoryFilter: string
  healthFilter: HealthFilter
  isLoading: boolean
  /** True only until the first load finishes, for skeleton states. */
  isBooting: boolean
  error: string | null
  mode: DataMode
  /** Why the configured cloud database is not in use; null when none is configured. */
  offlineReason: string | null
  /** Where local data is kept, when the platform can say. */
  storagePath: string | null

  fetchInitialData: () => Promise<void>
  selectProject: (projectId: number) => Promise<void>
  createProject: (name: string, description?: string, currency?: string) => Promise<void>
  updateProject: (
    id: number,
    data: { name: string; description?: string; currency: string }
  ) => Promise<void>
  deleteProject: (id: number) => Promise<void>
  addItem: (data: WorkPackageDraft) => Promise<WorkPackageItem>
  updateItem: (data: WorkPackageDraft & { id: number }) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  importItems: (newItems: WorkPackageDraft[]) => Promise<number>
  setSearchQuery: (query: string) => void
  setCategoryFilter: (category: string) => void
  setHealthFilter: (health: HealthFilter) => void
  clearFilters: () => void
}

function syncCurrency(project: Project | undefined): void {
  if (project?.currency) useAppStore.getState().setCurrency(project.currency)
}

export const useCostStore = create<CostState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  items: [],
  searchQuery: '',
  categoryFilter: 'ALL',
  healthFilter: 'ALL',
  isLoading: false,
  isBooting: true,
  error: null,
  mode: 'unknown',
  offlineReason: null,
  storagePath: null,

  fetchInitialData: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.costs.init()
      set({
        projects: data.projects,
        activeProjectId: data.activeProject?.id ?? null,
        items: data.items,
        mode: data.mode,
        offlineReason: data.offlineReason,
        storagePath: data.storagePath ?? null,
        isLoading: false,
        isBooting: false,
        categoryFilter: 'ALL'
      })
      syncCurrency(data.activeProject)
      // A notice explains something about the user's saved data, so it stays up longer.
      if (data.notice) useToastStore.getState().push({ tone: 'info', message: data.notice }, 12000)
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false, isBooting: false })
    }
  },

  selectProject: async (projectId: number) => {
    if (projectId === get().activeProjectId) return
    const project = get().projects.find((p) => p.id === projectId)
    set({
      activeProjectId: projectId,
      isLoading: true,
      error: null,
      categoryFilter: 'ALL',
      healthFilter: 'ALL',
      searchQuery: ''
    })
    try {
      const items = await api.costs.selectProject(projectId)
      // Ignore a late response if the user already switched again.
      if (get().activeProjectId !== projectId) return
      set({ items, isLoading: false })
      syncCurrency(project)
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false })
    }
  },

  createProject: async (name, description, currency = '$') => {
    set({ isLoading: true })
    try {
      const project = await api.costs.createProject({ name, description, currency })
      set((state) => ({
        projects: [project, ...state.projects],
        activeProjectId: project.id,
        items: [],
        categoryFilter: 'ALL',
        searchQuery: '',
        isLoading: false
      }))
      syncCurrency(project)
      toast.success(`Created “${project.name}”`)
    } catch (err: unknown) {
      set({ isLoading: false })
      toast.error(`Couldn't create the project: ${errorMessage(err)}`)
      throw err
    }
  },

  updateProject: async (id, data) => {
    try {
      const updated = await api.costs.updateProject({ id, ...data })
      set((state) => ({ projects: state.projects.map((p) => (p.id === id ? updated : p)) }))
      if (id === get().activeProjectId) syncCurrency(updated)
      toast.success('Project saved')
    } catch (err: unknown) {
      toast.error(`Couldn't save the project: ${errorMessage(err)}`)
      throw err
    }
  },

  deleteProject: async (id) => {
    const project = get().projects.find((p) => p.id === id)
    try {
      await api.costs.deleteProject(id)
      const remaining = get().projects.filter((p) => p.id !== id)
      set({ projects: remaining })
      toast.success(`Deleted “${project?.name ?? 'project'}”`)
      if (get().activeProjectId === id) {
        if (remaining.length > 0) {
          set({ activeProjectId: null })
          await get().selectProject(remaining[0].id)
        } else {
          set({ activeProjectId: null, items: [] })
        }
      }
    } catch (err: unknown) {
      toast.error(`Couldn't delete the project: ${errorMessage(err)}`)
      throw err
    }
  },

  addItem: async (data) => {
    const { activeProjectId } = get()
    if (!activeProjectId) throw new Error('Create or select a project first')
    try {
      const newItem = await api.costs.addItem({ projectId: activeProjectId, ...data })
      set((state) => ({ items: [...state.items, newItem] }))
      return newItem
    } catch (err: unknown) {
      throw new Error(errorMessage(err), { cause: err })
    }
  },

  updateItem: async (data) => {
    try {
      const updated = await api.costs.updateItem(data)
      set((state) => ({ items: state.items.map((i) => (i.id === updated.id ? updated : i)) }))
    } catch (err: unknown) {
      throw new Error(errorMessage(err), { cause: err })
    }
  },

  deleteItem: async (id: number) => {
    const removed = get().items.find((i) => i.id === id)
    if (!removed) return
    const previousItems = get().items
    // Optimistic: remove now, restore if the delete fails.
    set({ items: previousItems.filter((i) => i.id !== id) })
    try {
      await api.costs.deleteItem(id)
      toast.success(`Deleted “${removed.taskName}”`, {
        label: 'Undo',
        run: () => {
          const { addItem } = get()
          addItem({
            taskName: removed.taskName,
            category: removed.category,
            bac: removed.bac,
            plannedPercent: removed.plannedPercent,
            actualPercent: removed.actualPercent,
            actualCost: removed.actualCost,
            notes: removed.notes ?? ''
          })
            .then(() => toast.info(`Restored “${removed.taskName}”`))
            .catch((err) => toast.error(`Couldn't restore: ${errorMessage(err)}`))
        }
      })
    } catch (err: unknown) {
      set({ items: previousItems })
      toast.error(`Couldn't delete: ${errorMessage(err)}`)
    }
  },

  importItems: async (newItems) => {
    const { activeProjectId } = get()
    if (!activeProjectId) throw new Error('Create or select a project first')
    try {
      const inserted = await api.costs.bulkImport({
        projectId: activeProjectId,
        items: newItems
      })
      set((state) => ({ items: [...state.items, ...inserted] }))
      return inserted.length
    } catch (err: unknown) {
      throw new Error(errorMessage(err), { cause: err })
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setHealthFilter: (healthFilter) => set({ healthFilter }),
  clearFilters: () => set({ searchQuery: '', categoryFilter: 'ALL', healthFilter: 'ALL' })
}))
