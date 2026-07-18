import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA : enregistrement du service worker (prod uniquement, respecte le base path)
const isNativeApp = Boolean((window as any).Capacitor?.isNativePlatform?.());
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeApp) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => { /* hors ligne ou non supporté : l'app fonctionne sans */ });
  });
}
