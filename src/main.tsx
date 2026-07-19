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
  // Recharge une fois quand un nouveau service worker prend le contrôle
  // (après un déploiement) → l'utilisateur voit la nouvelle version sans manip.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      // updateViaCache: 'none' → le script sw.js n'est JAMAIS servi depuis le cache HTTP,
      // le navigateur détecte donc toujours une nouvelle version après un déploiement.
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => { /* hors ligne ou non supporté : l'app fonctionne sans */ });
  });
}
