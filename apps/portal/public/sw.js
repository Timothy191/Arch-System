const CACHE_NAME = 'arch-system-offline-v3';
const MEDIA_CACHE_NAME = 'arch-portal-media-v1';
const MAX_CACHE_ENTRIES = 120;
const MAX_MEDIA_CACHE_ENTRIES = 80;
const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MAX_CACHE_AGE_MS =
  DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const CACHED_AT_HEADER = 'x-arch-sw-cached-at';
const HTTP_OK_STATUS = 200;

const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/background/global-background-poster.webp',
  '/images/departments/overview.webp',
];

function isImmutableMediaAsset(urlStr) {
  return (
    urlStr.includes('/images/departments/') ||
    urlStr.includes('/background/') ||
    urlStr.includes('/_next/static/media/') ||
    /\.(?:webp|png|jpg|jpeg|svg|woff2)$/i.test(urlStr)
  );
}

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

async function enforceCacheBounds(cache, maxEntries = MAX_CACHE_ENTRIES) {
  const keys = await cache.keys();
  const overflowCount = keys.length - maxEntries;
  if (overflowCount > 0) {
    const evictionTargets = keys.slice(0, overflowCount);
    await Promise.all(evictionTargets.map((targetKey) => cache.delete(targetKey)));
  }
}

async function putWithCacheBounds(request, responseClone, targetCacheName = CACHE_NAME) {
  const cache = await caches.open(targetCacheName);
  const maxEntries =
    targetCacheName === MEDIA_CACHE_NAME ? MAX_MEDIA_CACHE_ENTRIES : MAX_CACHE_ENTRIES;
  if (targetCacheName === MEDIA_CACHE_NAME) {
    await cache.put(request, responseClone);
  } else {
    const stampedResponse = await stampResponseForCache(responseClone);
    await cache.put(request, stampedResponse);
  }
  await enforceCacheBounds(cache, maxEntries);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([CACHE_NAME, MEDIA_CACHE_NAME]);
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames.filter((name) => !validCaches.has(name)).map((name) => caches.delete(name))
          )
        ),
      self.registration?.navigationPreload
        ? self.registration.navigationPreload.enable().catch(() => {})
        : Promise.resolve(),
    ])
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const payload = event.data;
  if (payload?.type !== 'ARCH_PREWARM_ASSETS' || !Array.isArray(payload.urls)) {
    return;
  }
  event.waitUntil(
    caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
      for (const assetUrl of payload.urls) {
        if (typeof assetUrl !== 'string') continue;
        try {
          const existing = await cache.match(assetUrl);
          if (!existing) {
            const response = await fetch(assetUrl, { credentials: 'same-origin' });
            if (response.status === HTTP_OK_STATUS) {
              await cache.put(assetUrl, response);
            }
          }
        } catch {
          // Ignore individual background prewarm failures
        }
      }
      await enforceCacheBounds(cache, MAX_MEDIA_CACHE_ENTRIES);
    })
  );
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
  // are never shadowed by stale cached pages; consume Navigation Preload when available.
  if (isNavigationOrRsc) {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse =
            event.request.mode === 'navigate' && event.preloadResponse
              ? await event.preloadResponse
              : null;
          const networkResponse = preloadResponse || (await fetch(event.request));
          if (networkResponse.status === HTTP_OK_STATUS) {
            const copy = networkResponse.clone();
            void putWithCacheBounds(event.request, copy, CACHE_NAME);
          }
          return networkResponse;
        } catch {
          return caches.match(event.request);
        }
      })()
    );
    return;
  }

  // Cache-first for department images, background posters, and fonts so repeat views
  // and carousel rotations load in 0ms directly from the user's local storage.
  if (isImmutableMediaAsset(event.request.url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (mediaCache) => {
        const cachedMedia = await mediaCache.match(event.request);
        if (cachedMedia) {
          return cachedMedia;
        }
        const networkResponse = await fetch(event.request);
        if (networkResponse.status === HTTP_OK_STATUS) {
          void putWithCacheBounds(event.request, networkResponse.clone(), MEDIA_CACHE_NAME);
        }
        return networkResponse;
      })
    );
    return;
  }

  // Stale-while-revalidate for other static assets with age + LRU bounds
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const hasValidCache = Boolean(cachedResponse) && !isEntryExpired(cachedResponse, Date.now());
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === HTTP_OK_STATUS) {
            const copy = networkResponse.clone();
            void putWithCacheBounds(event.request, copy, CACHE_NAME);
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return hasValidCache ? cachedResponse : fetchPromise;
    })
  );
});
