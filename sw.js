// GearBalance Analyzer — Service Worker
// Bump CACHE_NAME whenever the app version (see index.html top comment) changes,
// so old cached assets get cleared out on the next online visit.
const CACHE_NAME = 'gbtorque-cache-v2.1.0';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache the app shell. Don't let one missing file (e.g. icons
// not yet uploaded) block the whole cache from being created.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('SW: could not cache', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting(); // activate the new SW as soon as it's installed
});

// Activate: clear out any old cache versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - index.html (and the root "./"): NETWORK-FIRST. Always try to get the
//   freshest copy from GitHub Pages when online, so updates show up the
//   moment they're pushed. Fall back to the cached copy when offline.
// - everything else (manifest, icons): CACHE-FIRST, since they rarely
//   change and it's faster/cheaper to just serve them from cache.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isAppShell =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/');

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return networkResponse;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return networkResponse;
        })
      );
    })
  );
});
