const CACHE_NAME = 'arch-system-offline-v2';

const PRECACHE_ASSETS = ['/', '/manifest.webmanifest', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignore non-GET and API/socket calls
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('socket.io')
  ) {
    return;
  }

  const isNavigationOrRsc =
    event.request.mode === 'navigate' ||
    event.request.headers.get('RSC') === '1' ||
    event.request.url.includes('_rsc=');

  // Media elements issue Range requests that return 206 Partial Content responses,
  // which cache.put() rejects. Let the browser handle them natively without caching.
  if (event.request.headers.has('range')) {
    return;
  }

  // Network-first for HTML page navigations & Next.js RSC payloads so live deployments
  // are never shadowed by stale cached pages; fall back to cache only when offline.
  if (isNavigationOrRsc) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for static assets (icons, fonts, immutable chunks)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});
