import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
  action?: { label: string; run: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => number
  dismiss: (id: number) => void
}

let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast, durationMs = toast.action ? 7000 : 4000) => {
    const id = nextId++
    // Keep at most three on screen; the oldest leaves first.
    set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }))
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), durationMs)
    )
    return id
  },

  dismiss: (id) => {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  }
}))

/** Shorthand usable outside React components (stores, async handlers). */
export const toast = {
  success: (message: string, action?: Toast['action']): number =>
    useToastStore.getState().push({ tone: 'success', message, action }),
  error: (message: string): number =>
    useToastStore.getState().push({ tone: 'error', message }, 6000),
  info: (message: string): number => useToastStore.getState().push({ tone: 'info', message })
}

/** Turns an IPC error ("Error invoking remote method 'x': Error: msg") into plain text. */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
