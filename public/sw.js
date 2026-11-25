const CACHE_NAME = 'offnex-ai-shell-v9';
const FALLBACK_URL = '/__offline_shell__';
const CORE_PRECACHE_URLS = [
  '/',
  '/admin',
  '/manifest.webmanifest',
  '/icon.png',
  '/apple-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/assets/offnex_icon_square.png',
  '/sw-register.js',
];
const SECONDARY_URLS = ['/admin'];

function buildEmergencyFallbackResponse() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Offnex Ai — Offline Ready</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0D18;color:#fff;font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center}
    .card{max-width:420px;background:#12152A;border:1px solid rgba(117,71,255,.35);border-radius:20px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.5)}
    h1{font-size:20px;margin:0 0 10px;font-weight:800}
    p{font-size:13px;line-height:1.6;color:#cbd5e1;margin:0 0 18px}
    button{background:linear-gradient(135deg,#4435D5,#7547FF);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-weight:700;font-size:13px;cursor:pointer}
  </style>
</head>
<body>
  <div class="card">
    <h1>Offnex Ai (Offline Ready)</h1>
    <p>Offline cache abhi sync ho raha hai. Ek bar internet on kar ke app khol lein taake sab files device par save ho jayein.</p>
    <button onclick="window.location.href='/'">Open App</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// Reconstruct clean non-redirected Response and strip Next.js `Vary` / `no-store` headers on cached HTML
// so CacheStorage always matches `/` and `/admin` reliably across standalone & offline launches.
async function toCleanCacheableResponse(response, stripVaryHeaders = false) {
  if (!response || !response.ok) return null;
  if (!response.redirected && !stripVaryHeaders) return response;
  try {
    const body = await response.clone().arrayBuffer();
    const headers = new Headers(response.headers);
    if (stripVaryHeaders) {
      headers.delete('vary');
      headers.delete('cache-control');
      headers.delete('pragma');
    }
    return new Response(body, {
      status: response.status,
      statusText: response.statusText || 'OK',
      headers,
    });
  } catch {
    return response;
  }
}

function isValidAppHtml(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') return false;
  return (
    htmlText.includes('/_next/') ||
    htmlText.includes('sw-register.js') ||
    htmlText.includes('Offnex') ||
    htmlText.includes('OfflineGPT')
  );
}

function isValidCacheableAsset(requestUrl, response) {
  if (!response || !response.ok) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const pathname = requestUrl.pathname.toLowerCase();

  const expectsNonHtml =
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/images/') ||
    /\.(js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|webmanifest|json)$/i.test(pathname);

  if (expectsNonHtml && contentType.includes('text/html')) {
    return false;
  }
  return true;
}

function addAssetIfAllowed(discovered, raw) {
  const clean = (raw || '').replace(/&amp;/g, '&').trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('javascript:')) {
    return;
  }
  try {
    const parsed = new URL(clean, self.location.origin);
    if (parsed.origin !== self.location.origin) return;
    if (
      parsed.pathname === '/sw.js' ||
      parsed.pathname.startsWith('/api/') ||
      parsed.pathname.startsWith('/_next/webpack-hmr')
    ) {
      return;
    }
    if (
      parsed.pathname.startsWith('/_next/static/') ||
      parsed.pathname.startsWith('/assets/') ||
      parsed.pathname.startsWith('/images/') ||
      /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|webmanifest)$/i.test(parsed.pathname)
    ) {
      discovered.add(parsed.href);
    }
  } catch {
    // Ignore malformed URLs
  }
}

function extractAssetsFromHtml(htmlText) {
  const discovered = new Set();
  const attrRegex = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrRegex.exec(htmlText)) !== null) {
    addAssetIfAllowed(discovered, match[1]);
  }
  const staticRegex = /\/_next\/static\/[^"'\s<>\\]+/gi;
  while ((match = staticRegex.exec(htmlText)) !== null) {
    addAssetIfAllowed(discovered, match[0]);
  }
  return Array.from(discovered);
}

async function fetchWithTimeout(request, timeoutMs) {
  if (typeof AbortController === 'undefined') {
    return fetch(request);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheUrlsSafely(cache, urls, forceRefreshPages = false, preferHttpCache = false) {
  const unique = Array.from(
    new Set(
      urls
        .map((u) => {
          try {
            const parsed = new URL(u, self.location.origin);
            if (parsed.origin !== self.location.origin) return null;
            if (
              parsed.pathname === '/sw.js' ||
              parsed.pathname.startsWith('/api/') ||
              parsed.pathname.startsWith('/_next/webpack-hmr')
            ) {
              return null;
            }
            return parsed.href;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    )
  );

  const BATCH_SIZE = 8;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (targetUrl) => {
        try {
          const parsed = new URL(targetUrl);
          const isPageRoute = parsed.pathname === '/' || parsed.pathname === '/admin';
          const existing = await cache.match(targetUrl, { ignoreVary: true });
          if (existing && (!isPageRoute || !forceRefreshPages)) return;

          const req = new Request(targetUrl, {
            credentials: 'same-origin',
            cache: isPageRoute
              ? forceRefreshPages
                ? 'reload'
                : 'default'
              : preferHttpCache
              ? 'force-cache'
              : 'default',
          });
          const res = await fetchWithTimeout(req, isPageRoute ? 8000 : 6000);
          if (!res || !res.ok) return;

          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (isPageRoute) {
            if (ct.includes('text/html')) {
              const clean = await toCleanCacheableResponse(res, true);
              if (clean) {
                const html = await clean.clone().text();
                if (isValidAppHtml(html)) {
                  await cache.put(targetUrl, clean.clone());
                  await cache.put(parsed.pathname, clean.clone());
                }
              }
            }
            return;
          }

          if (isValidCacheableAsset(parsed, res)) {
            const clean = await toCleanCacheableResponse(res, false);
            if (clean) {
              await cache.put(targetUrl, clean);
            }
          }
        } catch {
          // Ignore single failure
        }
      })
    );
  }
}

async function cacheFastInstallShell(cache) {
  const discoveredFromRoot = [];

  try {
    const rootRes = await fetchWithTimeout(
      new Request('/', { credentials: 'same-origin', cache: 'default' }),
      6000
    );
    if (
      rootRes &&
      rootRes.ok &&
      (rootRes.headers.get('content-type') || '').toLowerCase().includes('text/html')
    ) {
      const cleanRoot = await toCleanCacheableResponse(rootRes, true);
      if (cleanRoot) {
        const html = await cleanRoot.clone().text();
        if (isValidAppHtml(html)) {
          await cache.put('/', cleanRoot.clone());
          await cache.put(new URL('/', self.location.origin).href, cleanRoot.clone());
          discoveredFromRoot.push(...extractAssetsFromHtml(html));
        }
      }
    }
  } catch {
    // Continue caching essential icons & manifest
  }

  // Cache manifest, icons, and every JS/CSS chunk discovered in `/` HTML right during install
  // using preferHttpCache=true so chunks already downloaded by the tab save in <300ms.
  await cacheUrlsSafely(
    cache,
    [
      '/manifest.webmanifest',
      '/sw-register.js',
      '/icon.png',
      '/pwa-192x192.png',
      '/pwa-512x512.png',
      '/pwa-maskable-512x512.png',
      '/apple-touch-icon.png',
      '/assets/offnex_icon_square.png',
      ...discoveredFromRoot,
    ],
    false,
    true
  );
}

async function refreshFullShellCache(cache, extraUrls = [], includeSecondary = true) {
  const discoveredUrls = [];
  const routesToFetch = includeSecondary ? ['/', '/admin'] : ['/'];

  await Promise.allSettled(
    routesToFetch.map(async (pageRoute) => {
      try {
        const req = new Request(pageRoute, { credentials: 'same-origin', cache: 'reload' });
        const res = await fetchWithTimeout(req, 9000);
        if (
          res &&
          res.ok &&
          (res.headers.get('content-type') || '').toLowerCase().includes('text/html')
        ) {
          const clean = await toCleanCacheableResponse(res, true);
          if (clean) {
            const html = await clean.clone().text();
            if (isValidAppHtml(html)) {
              await cache.put(pageRoute, clean.clone());
              const fullUrl = new URL(pageRoute, self.location.origin).href;
              await cache.put(fullUrl, clean.clone());
              discoveredUrls.push(...extractAssetsFromHtml(html));
            }
          }
        }
      } catch {
        // Continue caching known URLs
      }
    })
  );

  await cacheUrlsSafely(
    cache,
    [
      ...CORE_PRECACHE_URLS,
      ...(includeSecondary ? SECONDARY_URLS : []),
      ...discoveredUrls,
      ...extraUrls,
    ],
    false,
    true
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(FALLBACK_URL, buildEmergencyFallbackResponse());
      await cacheFastInstallShell(cache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const keys = await caches.keys();

      // Migrate cached '/' from previous shell cache if current cache doesn't have it yet
      const hasRoot = await cache.match('/', { ignoreSearch: true, ignoreVary: true });
      if (!hasRoot) {
        for (const oldKey of keys) {
          if (oldKey === CACHE_NAME || !oldKey.startsWith('offnex-ai-shell')) continue;
          try {
            const oldCache = await caches.open(oldKey);
            const oldRoot = await oldCache.match('/', { ignoreSearch: true, ignoreVary: true });
            if (oldRoot) {
              const cleanOld = await toCleanCacheableResponse(oldRoot, true);
              if (cleanOld) {
                await cache.put('/', cleanOld.clone());
                await cache.put(new URL('/', self.location.origin).href, cleanOld.clone());
                break;
              }
            }
          } catch {
            // Ignore migration errors
          }
        }
      }

      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_ACTIVATED', cacheName: CACHE_NAME });
      }

      // Warm remaining secondary routes (/admin) & assets in background while SW is already controlling pages
      await refreshFullShellCache(cache, [], true);
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CLAIM_CLIENTS') {
    event.waitUntil(self.clients.claim());
    return;
  }

  if (data.type === 'FORCE_REFRESH_CACHE') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        await refreshFullShellCache(cache, Array.isArray(data.urls) ? data.urls : [], true);
        const allKeys = await cache.keys();
        const rootMatch = await cache.match('/', { ignoreSearch: true, ignoreVary: true });
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'OFFLINE_CACHE_READY',
            ready: Boolean(rootMatch),
            cachedCount: allKeys.length,
            cacheName: CACHE_NAME,
          });
        }
      })()
    );
    return;
  }

  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const hasRoot = await cache.match('/', { ignoreSearch: true, ignoreVary: true });
        if (!hasRoot) {
          await refreshFullShellCache(cache, data.urls, true);
        } else {
          await cacheUrlsSafely(cache, data.urls, false, true);
        }
        const allKeys = await cache.keys();
        const rootMatch = await cache.match('/', { ignoreSearch: true, ignoreVary: true });
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'OFFLINE_CACHE_READY',
            ready: Boolean(rootMatch),
            cachedCount: allKeys.length,
            cacheName: CACHE_NAME,
          });
        }
      })()
    );
    return;
  }

  if (data.type === 'PING_CACHE_STATUS') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const allKeys = await cache.keys();
        const rootMatch = await cache.match('/', { ignoreSearch: true, ignoreVary: true });
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'CACHE_STATUS',
            ready: Boolean(rootMatch),
            cachedCount: allKeys.length,
            cacheName: CACHE_NAME,
          });
        }
      })()
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/webpack-hmr')
  ) {
    return;
  }

  // 1. HTML Page Navigations — Offline-first & fast 1200ms network race when cached shell exists
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const findCachedNavigation = async () => {
          const match =
            (await cache.match(request, { ignoreVary: true })) ||
            (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
            (await cache.match(url.pathname, { ignoreVary: true })) ||
            (await cache.match('/', { ignoreSearch: true, ignoreVary: true })) ||
            (await cache.match('/', { ignoreVary: true })) ||
            (await cache.match(FALLBACK_URL, { ignoreVary: true }));
          if (match) {
            return (await toCleanCacheableResponse(match, true)) || match;
          }
          return null;
        };

        const cachedDoc = await findCachedNavigation();

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return cachedDoc || buildEmergencyFallbackResponse();
        }

        const timeoutMs = cachedDoc ? 1200 : 7000;
        try {
          const networkResponse = await fetchWithTimeout(request, timeoutMs);
          if (networkResponse && networkResponse.ok) {
            const ct = (networkResponse.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) {
              const clean = await toCleanCacheableResponse(networkResponse, true);
              if (clean) {
                const html = await clean.clone().text();
                if (isValidAppHtml(html)) {
                  await cache.put(request, clean.clone()).catch(() => undefined);
                  if (url.pathname === '/' || url.pathname === '/admin') {
                    await cache.put(url.pathname, clean.clone()).catch(() => undefined);
                    await cache.put(new URL(url.pathname, self.location.origin).href, clean.clone()).catch(() => undefined);
                  }
                  const discovered = extractAssetsFromHtml(html);
                  if (discovered.length > 0) {
                    event.waitUntil(cacheUrlsSafely(cache, discovered, false, true));
                  }
                  return clean;
                }
                if (cachedDoc) return cachedDoc;
              }
            }
            return networkResponse;
          }
          return cachedDoc || buildEmergencyFallbackResponse();
        } catch {
          return cachedDoc || buildEmergencyFallbackResponse();
        }
      })()
    );
    return;
  }

  // Handle Next.js RSC soft navigations cleanly offline
  if (url.searchParams.has('_rsc')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return (await cache.match(request, { ignoreVary: true })) || Response.error();
        }
        try {
          const res = await fetchWithTimeout(request, 2000);
          if (res && res.ok) {
            const clean = await toCleanCacheableResponse(res, true);
            if (clean) {
              await cache.put(request, clean.clone()).catch(() => undefined);
              return clean;
            }
          }
          return res;
        } catch {
          return (await cache.match(request, { ignoreVary: true })) || Response.error();
        }
      })()
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/sw-register.js' ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff|woff2|css|js|mjs|webmanifest)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  // 2. Static Assets — Instant Cache-First + Background Revalidate across all hosts
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached =
        (await cache.match(request, { ignoreVary: true })) ||
        (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
        (await cache.match(url.pathname, { ignoreVary: true }));

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return cached || Response.error();
      }

      const networkPromise = fetchWithTimeout(request, 6000)
        .then(async (response) => {
          if (isValidCacheableAsset(url, response)) {
            const clean = await toCleanCacheableResponse(response, true);
            if (clean) {
              await cache.put(request, clean.clone()).catch(() => undefined);
              return clean;
            }
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const fresh = await networkPromise;
      return fresh || Response.error();
    })()
  );
});
