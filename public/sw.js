const CACHE_NAME = 'offnex-ai-shell-v5';
const FALLBACK_URL = '/__offline_shell__';
const PRECACHE_URLS = [
  '/',
  '/admin',
  '/manifest.webmanifest',
  '/icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/assets/offnex_icon_square.png',
];

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
    <h1>Offnex Ai (Offline Shell)</h1>
    <p>Internet connection is off. Tap below to reload your cached Offnex Ai workspace, or connect once briefly so all offline files finish syncing.</p>
    <button onclick="window.location.href='/'">Open Cached App</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function isValidCacheableAsset(requestUrl, response) {
  if (!response || !response.ok) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const pathname = requestUrl.pathname.toLowerCase();

  // Never store or serve an HTML page (404/502 error page) as JS, CSS, image, font, or manifest
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

function extractAssetsFromHtml(htmlText) {
  const discovered = new Set();
  const attrRegex = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrRegex.exec(htmlText)) !== null) {
    const raw = (match[1] || '').replace(/&amp;/g, '&').trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('javascript:')) {
      continue;
    }
    try {
      const parsed = new URL(raw, self.location.origin);
      if (parsed.origin !== self.location.origin) continue;
      if (
        parsed.pathname === '/sw.js' ||
        parsed.pathname.startsWith('/api/') ||
        parsed.pathname.startsWith('/_next/webpack-hmr')
      ) {
        continue;
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
  return Array.from(discovered);
}

async function cacheUrlsSafely(cache, urls) {
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

  await Promise.allSettled(
    unique.map(async (targetUrl) => {
      try {
        const parsed = new URL(targetUrl);
        const existing = await cache.match(targetUrl);
        // Always refresh page HTML routes during explicit precache, skip already-cached immutable assets
        const isPageRoute = parsed.pathname === '/' || parsed.pathname === '/admin';
        if (existing && !isPageRoute) return;

        const req = new Request(targetUrl, {
          credentials: 'same-origin',
          cache: isPageRoute ? 'reload' : 'default',
        });
        const res = await fetch(req);
        if (!res || !res.ok) return;

        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (isPageRoute) {
          if (ct.includes('text/html')) {
            await cache.put(targetUrl, res.clone());
            if (parsed.pathname === '/') {
              await cache.put('/', res.clone());
            }
          }
          return;
        }

        if (isValidCacheableAsset(parsed, res)) {
          await cache.put(targetUrl, res);
        }
      } catch {
        // Ignore single asset failure so remaining offline assets still cache cleanly
      }
    })
  );
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(FALLBACK_URL, buildEmergencyFallbackResponse());

      let discoveredUrls = [];
      try {
        const rootReq = new Request('/', { credentials: 'same-origin', cache: 'reload' });
        const rootRes = await fetchWithTimeout(rootReq, 8000);
        if (rootRes && rootRes.ok && (rootRes.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
          await cache.put('/', rootRes.clone());
          const html = await rootRes.clone().text();
          discoveredUrls = extractAssetsFromHtml(html);
        }
      } catch {
        // Continue with PRECACHE_URLS even if root html fetch fails
      }

      await cacheUrlsSafely(cache, [...PRECACHE_URLS, ...discoveredUrls]);
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
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_ACTIVATED', cacheName: CACHE_NAME });
      }
    })()
  );
});

async function refreshFullShellCache(cache, extraUrls = []) {
  let discoveredUrls = [];
  for (const pageRoute of ['/', '/admin']) {
    try {
      const req = new Request(pageRoute, { credentials: 'same-origin', cache: 'reload' });
      const res = await fetchWithTimeout(req, 8000);
      if (res && res.ok && (res.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
        await cache.put(pageRoute, res.clone());
        const html = await res.clone().text();
        discoveredUrls = discoveredUrls.concat(extractAssetsFromHtml(html));
      }
    } catch {
      // Ignore single route failure
    }
  }
  await cacheUrlsSafely(cache, [...PRECACHE_URLS, ...discoveredUrls, ...extraUrls]);
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'FORCE_REFRESH_CACHE') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        await refreshFullShellCache(cache, Array.isArray(data.urls) ? data.urls : []);
        const allKeys = await cache.keys();
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'OFFLINE_CACHE_READY',
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
        await cacheUrlsSafely(cache, data.urls);
        const allKeys = await cache.keys();
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'OFFLINE_CACHE_READY',
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

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept service worker script itself, API routes, or HMR websocket/endpoints
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/webpack-hmr')
  ) {
    return;
  }

  // 1. HTML Page Navigations — Offline-safe with immediate cache fallback and zero Dinosaur error
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const findCachedNavigation = async () => {
          const exactOrSearchIgnored =
            (await cache.match(request)) ||
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match(url.pathname)) ||
            (await cache.match('/', { ignoreSearch: true })) ||
            (await cache.match('/'));
          return exactOrSearchIgnored || (await cache.match(FALLBACK_URL)) || buildEmergencyFallbackResponse();
        };

        // When browser already knows internet is off, serve cached app shell immediately
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          const cachedOffline =
            (await cache.match(request)) ||
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match('/', { ignoreSearch: true }));
          if (cachedOffline) {
            return cachedOffline;
          }
        }

        try {
          const networkResponse = await fetchWithTimeout(request, 5000);
          if (networkResponse && networkResponse.ok) {
            const ct = (networkResponse.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) {
              await cache.put(request, networkResponse.clone()).catch(() => undefined);
              if (url.pathname === '/' || url.pathname === '/admin') {
                await cache.put(url.pathname, networkResponse.clone()).catch(() => undefined);
              }
            }
            return networkResponse;
          }
          return await findCachedNavigation();
        } catch {
          return await findCachedNavigation();
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
    /\.(png|jpg|jpeg|webp|svg|ico|woff|woff2|css|js|mjs|webmanifest)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  // 2. Static Assets (JS chunks, CSS, media, fonts, icons, manifest)
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const matchCached = async () =>
        (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));

      // When offline, serve cached bundle immediately
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offlineAsset = await matchCached();
        if (offlineAsset) return offlineAsset;
      }

      if (IS_DEV_HOST) {
        try {
          const response = await fetchWithTimeout(request, 4000);
          if (isValidCacheableAsset(url, response)) {
            await cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        } catch {
          return (await matchCached()) || Response.error();
        }
      }

      // Production / Pre-release: serve fast from cache and refresh in background
      const cached = await matchCached();
      const networkPromise = fetch(request)
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
