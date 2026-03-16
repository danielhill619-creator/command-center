import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './shared/hooks/useAuth'

// ── Auto-update check ─────────────────────────────────────────────────────────
// On every load, fetch the deployed index.html (bypassing cache) and compare
// the JS bundle filename. If a new deployment has happened, force a fresh load.
;(function checkForUpdate() {
  const current = document.querySelector('script[src*="/assets/index-"]')
    ?.getAttribute('src')
  if (!current) return

  fetch(window.location.origin + '/', {
    cache: 'no-store',
    headers: { pragma: 'no-cache', 'cache-control': 'no-cache' },
  })
    .then(r => r.text())
    .then(html => {
      const match = html.match(/\/assets\/index-[^"]+\.js/)
      if (match && match[0] !== current) {
        // New bundle detected — hard reload to pick up the latest version
        window.location.replace(window.location.href.split('?')[0] + '?_v=' + Date.now())
      }
    })
    .catch(() => {})
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
