/* FretByW00d — service worker (offline + installable).
   La liste PRECACHE et le numéro de build sont injectés par scripts/generate-sw.mjs. */

const VERSION = 'fbw-__BUILD__';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SAMPLES = 'fbw-samples'; // conservé entre les versions (gros téléchargements audio)

const PRECACHE_URLS = /*__PRECACHE__*/[];

/* Hôtes tiers mis en cache longue durée : samples smplr + polices */
const THIRD_PARTY_HOSTS = [
  'gleitz.github.io',
  'smpldsnds.github.io',
  'goldst.dev',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL && k !== RUNTIME && k !== SAMPLES)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigations : réseau d'abord (fraîcheur), coquille en secours (offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Assets même origine (fichiers hachés, immuables) : cache d'abord
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // Samples audio + polices : cache d'abord, longue durée
  if (THIRD_PARTY_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(SAMPLES).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
  }
});
