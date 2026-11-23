const CACHE_NAME = 'offnex-ai-shell-v7';
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

const IS_DEV_HOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.startsWith('ais-dev-');

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

// Chrome rejects a Service Worker `navigate` response if `response.redirected === true`.
// Always reconstruct a clean non-redirected Response before storing in CacheStorage or returning.
async function toCleanCacheableResponse(response) {
  if (!response || !response.ok) return null;
  if (!response.redirected) return response;
  try {
    const body = await response.clone().arrayBuffer();
    const headers = new Headers(response.headers);
    return new Response(body, {
      status: response.status,
      statusText: response.statusText || 'OK',
      headers,
    });
  } catch {
    return response;
  }
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
  // Also catch Next.js Flight inline script chunk references
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

async function cacheUrlsSafely(cache, urls, forceRefreshPages = false) {
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

  // Batch fetches cleanly (6 at a time) so Chrome socket pool stays responsive
  const BATCH_SIZE = 6;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (targetUrl) => {
        try {
          const parsed = new URL(targetUrl);
          const isPageRoute = parsed.pathname === '/' || parsed.pathname === '/admin';
          const existing = await cache.match(targetUrl);
          if (existing && (!isPageRoute || !forceRefreshPages)) return;

          const req = new Request(targetUrl, {
            credentials: 'same-origin',
            cache: isPageRoute ? 'reload' : 'default',
          });
          const res = await fetchWithTimeout(req, isPageRoute ? 9000 : 7000);
          if (!res || !res.ok) return;

          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (isPageRoute) {
            if (ct.includes('text/html')) {
              const clean = await toCleanCacheableResponse(res);
              if (clean) {
                await cache.put(targetUrl, clean.clone());
                await cache.put(parsed.pathname, clean.clone());
              }
            }
            return;
          }

          if (isValidCacheableAsset(parsed, res)) {
            const clean = await toCleanCacheableResponse(res);
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

async function refreshFullShellCache(cache, extraUrls = [], includeSecondary = true) {
  const discoveredUrls = [];
  const routesToFetch = includeSecondary ? ['/', '/admin'] : ['/'];

  await Promise.allSettled(
    routesToFetch.map(async (pageRoute) => {
      try {
        const req = new Request(pageRoute, { credentials: 'same-origin', cache: 'reload' });
        const res = await fetchWithTimeout(req, 10000);
        if (
          res &&
          res.ok &&
          (res.headers.get('content-type') || '').toLowerCase().includes('text/html')
        ) {
          const clean = await toCleanCacheableResponse(res);
          if (clean) {
            await cache.put(pageRoute, clean.clone());
            const fullUrl = new URL(pageRoute, self.location.origin).href;
            await cache.put(fullUrl, clean.clone());
            const html = await clean.clone().text();
            discoveredUrls.push(...extractAssetsFromHtml(html));
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
    false
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(FALLBACK_URL, buildEmergencyFallbackResponse());

      // Precache '/' + '/admin' and all HTML-referenced JS/CSS chunks + icons immediately on install
      await refreshFullShellCache(cache, [], true);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();

      // Ensure full shell & /admin assets are warmed right after activation
      caches
        .open(CACHE_NAME)
        .then((cache) => refreshFullShellCache(cache, [], true))
        .catch(() => undefined);

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_ACTIVATED', cacheName: CACHE_NAME });
      }
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
        const rootMatch = await cache.match('/', { ignoreSearch: true });
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
        const hasRoot = await cache.match('/', { ignoreSearch: true });
        if (!hasRoot) {
          await refreshFullShellCache(cache, data.urls, true);
        } else {
          await cacheUrlsSafely(cache, data.urls, false);
        }
        const allKeys = await cache.keys();
        const rootMatch = await cache.match('/', { ignoreSearch: true });
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
        const rootMatch = await cache.match('/', { ignoreSearch: true });
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

  // 1. HTML Page Navigations — Offline-first safety with fast background/timeout refresh
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const findCachedNavigation = async () => {
          const match =
            (await cache.match(request)) ||
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match(url.pathname)) ||
            (await cache.match('/', { ignoreSearch: true })) ||
            (await cache.match('/')) ||
            (await cache.match(FALLBACK_URL));
          if (match) {
            return (await toCleanCacheableResponse(match)) || match;
          }
          return null;
        };

        const cachedDoc = await findCachedNavigation();

        // When browser knows internet is off, serve cached app shell immediately
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return cachedDoc || buildEmergencyFallbackResponse();
        }

        // Try network with shorter timeout when cached shell already exists so flaky Wi-Fi never stalls PWA launch
        const timeoutMs = cachedDoc ? 2200 : 8000;
        try {
          const networkResponse = await fetchWithTimeout(request, timeoutMs);
          if (networkResponse && networkResponse.ok) {
            const ct = (networkResponse.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) {
              const clean = await toCleanCacheableResponse(networkResponse);
              if (clean) {
                await cache.put(request, clean.clone()).catch(() => undefined);
                if (url.pathname === '/' || url.pathname === '/admin') {
                  await cache.put(url.pathname, clean.clone()).catch(() => undefined);
                }
                return clean;
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
          return (await cache.match(request)) || Response.error();
        }
        try {
          const res = await fetchWithTimeout(request, 2500);
          if (res && res.ok) {
            await cache.put(request, res.clone()).catch(() => undefined);
          }
          return res;
        } catch {
          return (await cache.match(request)) || Response.error();
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

  // 2. Static Assets (JS chunks, CSS, media, fonts, icons, manifest)
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const matchCached = async () =>
        (await cache.match(request)) ||
        (await cache.match(request, { ignoreSearch: true })) ||
        (await cache.match(url.pathname));

      const cached = await matchCached();

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return cached || Response.error();
      }

      if (IS_DEV_HOST) {
        // Use fast timeout when cached exists so offline/broken router never hangs chunk loading
        try {
          const response = await fetchWithTimeout(request, cached ? 900 : 4000);
          if (isValidCacheableAsset(url, response)) {
            await cache.put(request, response.clone()).catch(() => undefined);
            return response;
          }
          if (cached) return cached;
          return response;
        } catch {
          return cached || Response.error();
        }
      }

      const networkPromise = fetchWithTimeout(request, 6000)
        .then((response) => {
          if (isValidCacheableAsset(url, response)) {
            cache.put(request, response.clone()).catch(() => undefined);
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
