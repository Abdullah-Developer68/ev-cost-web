import { useAppStore } from '../store/useAppStore'
import { useCostStore } from '../store/useCostStore'
import { errorMessage, toast } from '../store/useToastStore'
import { api } from './api'
import { DEFAULT_TAB, documentTitle, hashForTab, tabFromHash } from './routes'

/**
 * Keeps the URL hash and the store's `activeTab` in step, both ways, so a
 * refresh, a deep link and the back and forward buttons all land on the right page.
 */
function startHashRouting(): void {
  const fromUrl = tabFromHash(window.location.hash)
  if (fromUrl) useAppStore.setState({ activeTab: fromUrl })
  else {
    const tab = useAppStore.getState().activeTab ?? DEFAULT_TAB
    window.history.replaceState(window.history.state, '', hashForTab(tab))
  }

  // Store -> URL. A page change made in the app is a new history entry.
  useAppStore.subscribe((state, previous) => {
    if (state.activeTab === previous.activeTab) return
    const hash = hashForTab(state.activeTab)
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
  })

  // URL -> store: back/forward, links, hand-typed hashes.
  const onUrlChange = (): void => {
    const tab = tabFromHash(window.location.hash)
    if (!tab) {
      window.history.replaceState(
        window.history.state,
        '',
        hashForTab(useAppStore.getState().activeTab)
      )
      return
    }
    if (tab !== useAppStore.getState().activeTab) useAppStore.getState().setActiveTab(tab)
  }
  window.addEventListener('popstate', onUrlChange)
  window.addEventListener('hashchange', onUrlChange)
}

/** The browser tab title follows the page and the project. */
function startDocumentTitle(): void {
  const update = (): void => {
    const { activeTab } = useAppStore.getState()
    const { projects, activeProjectId } = useCostStore.getState()
    const project = projects.find((p) => p.id === activeProjectId)
    document.title = documentTitle(activeTab, project?.name)
  }
  update()
  useAppStore.subscribe((s, p) => s.activeTab !== p.activeTab && update())
  useCostStore.subscribe(
    (s, p) => (s.projects !== p.projects || s.activeProjectId !== p.activeProjectId) && update()
  )
}

/** `<meta name="theme-color">` follows the active theme's canvas colour token. */
function startThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) return
  const update = (): void => {
    const plane = getComputedStyle(document.documentElement).getPropertyValue('--plane').trim()
    if (plane) meta.content = plane
  }
  update()
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
}

/**
 * Picks up changes another tab saved. The open project stays open when it
 * still exists; otherwise the first project is shown, as on a fresh load.
 */
function startCrossTabSync(): void {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage) return
    if (!api.data.reloadFromStorage(event.key)) return
    void (async () => {
      try {
        const keep = useCostStore.getState().activeProjectId
        const data = await api.costs.init()
        const stillThere = data.projects.find((p) => p.id === keep)
        const active = stillThere ?? data.activeProject
        const items = stillThere ? await api.costs.selectProject(active.id) : data.items
        useCostStore.setState({ projects: data.projects, activeProjectId: active.id, items })
        useAppStore.getState().setCurrency(active.currency)
        // An open record may be stale now; close the drawer that shows it.
        const inspected = useAppStore.getState().inspectedItem
        if (inspected) {
          const fresh = items.find((i) => i.id === inspected.id) ?? null
          useAppStore.getState().setInspectedItem(fresh)
        }
        toast.info('Updated with changes made in another tab')
      } catch (err: unknown) {
        toast.error(`Couldn't load changes from another tab: ${errorMessage(err)}`)
      }
    })()
  })
}

let started = false

/** Everything the web build adds around the shared app. Called once, before the first render. */
export function startWebPlatform(): void {
  if (started) return
  started = true
  startHashRouting()
  startDocumentTitle()
  startThemeColor()
  startCrossTabSync()
}
