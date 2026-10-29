const CACHE_NAME = 'arch-system-offline-v3';
const MAX_CACHE_ENTRIES = 120;
const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MAX_CACHE_AGE_MS =
  DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const CACHED_AT_HEADER = 'x-arch-sw-cached-at';
const HTTP_OK_STATUS = 200;

const PRECACHE_ASSETS = ['/', '/manifest.webmanifest', '/favicon.ico'];

async function stampResponseForCache(response) {
  try {
    const bodyBuffer = await response.clone().arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set(CACHED_AT_HEADER, String(Date.now()));
    return new Response(bodyBuffer, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

function isEntryExpired(cachedResponse, nowMs) {
  if (!cachedResponse) return false;
  const stampedAt = Number(cachedResponse.headers.get(CACHED_AT_HEADER));
  if (Number.isFinite(stampedAt) && stampedAt > 0) {
    return nowMs - stampedAt > MAX_CACHE_AGE_MS;
  }
  const dateHeader = cachedResponse.headers.get('date');
  if (dateHeader) {
    const parsedDateMs = Date.parse(dateHeader);
    if (Number.isFinite(parsedDateMs)) {
      return nowMs - parsedDateMs > MAX_CACHE_AGE_MS;
    }
  }
  return false;
}

async function enforceCacheBounds(cache) {
  const keys = await cache.keys();
  const nowMs = Date.now();
  const liveKeys = [];

  for (const requestKey of keys) {
    const cachedResp = await cache.match(requestKey);
    if (isEntryExpired(cachedResp, nowMs)) {
      await cache.delete(requestKey);
    } else {
      liveKeys.push(requestKey);
    }
  }

  const overflowCount = liveKeys.length - MAX_CACHE_ENTRIES;
  if (overflowCount > 0) {
    const evictionTargets = liveKeys.slice(0, overflowCount);
    await Promise.all(evictionTargets.map((targetKey) => cache.delete(targetKey)));
  }
}

async function putWithCacheBounds(request, responseClone) {
  const cache = await caches.open(CACHE_NAME);
  const stampedResponse = await stampResponseForCache(responseClone);
  await cache.put(request, stampedResponse);
  await enforceCacheBounds(cache);
}

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
          if (networkResponse.status === HTTP_OK_STATUS) {
            const copy = networkResponse.clone();
            void putWithCacheBounds(event.request, copy);
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for static assets (icons, fonts, immutable chunks) with age + LRU bounds
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const hasValidCache = Boolean(cachedResponse) && !isEntryExpired(cachedResponse, Date.now());
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === HTTP_OK_STATUS) {
            const copy = networkResponse.clone();
            void putWithCacheBounds(event.request, copy);
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return hasValidCache ? cachedResponse : fetchPromise;
    })
  );
});
