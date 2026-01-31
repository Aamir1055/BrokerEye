import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Silence noisy logs unless explicitly enabled
const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'
if (!DEBUG_LOGS) {
  // Keep errors and warnings; silence info/debug/log
  // eslint-disable-next-line no-console
  console.log = () => {}
  // eslint-disable-next-line no-console
  console.info = () => {}
  // eslint-disable-next-line no-console
  console.debug = () => {}
}

// Unregister any existing service workers in development
if (import.meta.env.DEV) {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof navigator.serviceWorker?.getRegistrations === 'function') {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          try {
            registration.unregister()
            if (DEBUG_LOGS) console.log('Service Worker unregistered:', registration.scope)
          } catch {}
        }
      }).catch(() => {
        // Ignore environments where service workers are disallowed
      })
    }
  } catch {
    // Ignore environments where service workers are disallowed
  }
}

createRoot(document.getElementById('root')).render(
  <App />
)
