import { create } from 'zustand'
import { WorkPackageItem } from '../types'
import { readThemePreference, saveThemePreference, ThemePreference } from '../lib/theme'

export type TabType = 'dashboard' | 'costs' | 'actions' | 'reports'

export interface ConfirmRequest {
  title: string
  body: string
  confirmLabel: string
  tone?: 'danger' | 'default'
  onConfirm: () => void | Promise<void>
}

interface AppState {
  activeTab: TabType
  isAddModalOpen: boolean
  editingItem: WorkPackageItem | null
  isImportModalOpen: boolean
  isSettingsModalOpen: boolean
  /** Project settings open in "create new project" mode instead of editing the active one. */
  settingsMode: 'edit' | 'create'
  inspectedItem: WorkPackageItem | null
  confirm: ConfirmRequest | null
  isCommandOpen: boolean
  currency: string
  theme: ThemePreference

  setActiveTab: (tab: TabType) => void
  setIsAddModalOpen: (open: boolean) => void
  setEditingItem: (item: WorkPackageItem | null) => void
  setIsImportModalOpen: (open: boolean) => void
  setIsSettingsModalOpen: (open: boolean, mode?: 'edit' | 'create') => void
  setInspectedItem: (item: WorkPackageItem | null) => void
  requestConfirm: (request: ConfirmRequest | null) => void
  setIsCommandOpen: (open: boolean) => void
  setCurrency: (currency: string) => void
  setTheme: (theme: ThemePreference) => void
  /** Closes whichever overlay is on top. Returns false when nothing was open. */
  closeTopOverlay: () => boolean
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'dashboard',
  isAddModalOpen: false,
  editingItem: null,
  isImportModalOpen: false,
  isSettingsModalOpen: false,
  settingsMode: 'edit',
  inspectedItem: null,
  confirm: null,
  isCommandOpen: false,
  currency: '$',
  theme: typeof window === 'undefined' ? 'system' : readThemePreference(),

  setActiveTab: (activeTab) => set({ activeTab }),
  setIsAddModalOpen: (isAddModalOpen) =>
    set((state) => ({
      isAddModalOpen,
      editingItem: isAddModalOpen ? state.editingItem : null
    })),
  setEditingItem: (editingItem) =>
    set({
      editingItem,
      isAddModalOpen: editingItem !== null
    }),
  setIsImportModalOpen: (isImportModalOpen) => set({ isImportModalOpen }),
  setIsSettingsModalOpen: (isSettingsModalOpen, settingsMode = 'edit') =>
    set({ isSettingsModalOpen, settingsMode }),
  setInspectedItem: (inspectedItem) => set({ inspectedItem }),
  requestConfirm: (confirm) => set({ confirm }),
  setIsCommandOpen: (isCommandOpen) => set({ isCommandOpen }),
  setCurrency: (currency) => set({ currency }),
  setTheme: (theme) => {
    saveThemePreference(theme)
    set({ theme })
  },

  closeTopOverlay: () => {
    const s = get()
    if (s.isCommandOpen) set({ isCommandOpen: false })
    else if (s.confirm) set({ confirm: null })
    else if (s.isAddModalOpen) set({ isAddModalOpen: false, editingItem: null })
    else if (s.isImportModalOpen) set({ isImportModalOpen: false })
    else if (s.isSettingsModalOpen) set({ isSettingsModalOpen: false })
    else if (s.inspectedItem) set({ inspectedItem: null })
    else return false
    return true
  }
}))
