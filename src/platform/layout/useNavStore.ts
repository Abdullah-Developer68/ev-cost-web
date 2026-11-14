import { create } from 'zustand'

interface NavState {
  /** The off-canvas navigation drawer (below 1024px) is open. */
  open: boolean
  setOpen: (open: boolean) => void
}

/** Web-only layout state: whether the mobile navigation drawer is open. */
export const useNavStore = create<NavState>((set) => ({
  open: false,
  setOpen: (open) => set({ open })
}))
