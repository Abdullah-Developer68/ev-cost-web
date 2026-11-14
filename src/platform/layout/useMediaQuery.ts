import { useSyncExternalStore } from 'react'

/** The persistent sidebar's breakpoint (Tailwind `lg`). Below it the sidebar is a drawer. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

/** True while the media query matches; re-renders when it flips. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => true
  )
}
