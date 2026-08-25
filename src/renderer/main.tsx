// Renderer entry point — boots one BrowserWindow's React tree.
//
// Three one-time initialisations run BEFORE React mounts, in this order:
// localStorage migrations (v0.8.10, B135 — rewrites stale per-character keys
// so the first read below sees transformed values), then `initTheme`, then
// `initSettings`. Keep the migration first; everything after it reads the
// keys it may rewrite. Then `<App />` mounts under StrictMode.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { initTheme } from './themes'
import { initSettings } from './settings'
import { runLocalStorageMigrations } from './localStorageMigrations'

// v0.8.10 (B135): localStorage migrations run BEFORE initTheme / initSettings
// so any character whose settings need rewriting (e.g. panelFontSizes key
// rename) gets the transformed values when the renderer first reads them.
runLocalStorageMigrations()
initTheme()
initSettings()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
