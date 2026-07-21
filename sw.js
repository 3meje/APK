// Digits Pro — service worker
// Purpose: make the app installable and load instantly on repeat visits.
// It deliberately does NOT cache or intercept anything going to Deriv's
// API/WebSocket — trading data must always be live, never served stale.

const CACHE_NAME = 'digits-pro-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests for the shell itself.
  // Everything else (Deriv API, WebSocket upgrade, fonts, etc.) passes
  // straight through to the network, untouched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')))) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      // stale-while-revalidate: instant load from cache, refresh in background
      return cached || network;
    })
  );
});
