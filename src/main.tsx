// Web: must run before any zod schema is created (see the file).
import './platform/csp'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './assets/main.css'
import './platform/web.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, readThemePreference, resolveTheme, systemPrefersDark } from './lib/theme'
import { startWebPlatform } from './platform/web'

// Apply the saved theme before React renders so the first frame is already right.
applyTheme(resolveTheme(readThemePreference(), systemPrefersDark()))
// Web: hash routes, cross-tab sync and theme-color, wired before the first render.
startWebPlatform()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
