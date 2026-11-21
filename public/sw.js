const CACHE_NAME = 'offnex-ai-shell-v3';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
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

function isValidCacheableAsset(requestUrl, response) {
  if (!response || !response.ok) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const pathname = requestUrl.pathname.toLowerCase();

  // Never store or serve an HTML page (404/502 error page) as JS, CSS, image, font, or manifest
  const expectsNonHtml =
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/images/') ||
    /\.(js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff2|webmanifest|json)$/i.test(pathname);

  if (expectsNonHtml && contentType.includes('text/html')) {
    return false;
  }
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
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

  // Network-first for HTML page navigations, with cached offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const ct = (response.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/images/') ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2|css|js|webmanifest)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  // In dev preview, always prefer fresh network chunks first so rebuilds never serve stale JS
  // and only fall back to cache when genuinely offline.
  if (IS_DEV_HOST) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isValidCacheableAsset(url, response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  // In production builds, use fast cache + background revalidate while strictly blocking HTML-for-JS poisoning
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (isValidCacheableAsset(url, response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached || Response.error());

      return cached || networkFetch;
    })
  );
});
