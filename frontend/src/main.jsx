/** Punto de montaje de Scolyax en el navegador. */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './dashboard-styles.css'
import './performance.css'
import './scolyax-theme.css'
import { registerServiceWorker } from './utils/serviceWorkerManager'

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker()
      .then(registration => {
        if (registration) {
          console.log('✅ PWA lista para funcionar offline')
        }
      })
      .catch(error => {
        console.error('❌ Error al registrar PWA:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
