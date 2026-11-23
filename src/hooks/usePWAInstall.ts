'use client';

import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

export interface OfflineCacheStatus {
  ready: boolean;
  controlled: boolean;
  cachedCount: number;
  cacheName: string;
}

// Global store so `beforeinstallprompt` is never lost before opening Settings
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstalled = false;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function collectRuntimeAssetUrls(extraUrls: string[] = []): string[] {
  if (typeof window === 'undefined') return [];
  const urls = new Set<string>([
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
    ...extraUrls,
  ]);

  try {
    urls.add(window.location.href);
  } catch {
    // Ignore
  }

  if (typeof document !== 'undefined') {
    document
      .querySelectorAll('script[src], link[href], img[src]')
      .forEach((el) => {
        const attr = el.getAttribute('src') || el.getAttribute('href');
        if (!attr) return;
        try {
          const parsed = new URL(attr, window.location.origin);
          if (parsed.origin === window.location.origin) {
            urls.add(parsed.href);
          }
        } catch {
          // Ignore invalid URL
        }
      });
  }

  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const entry of resources) {
        if (!entry.name) continue;
        try {
          const parsed = new URL(entry.name, window.location.origin);
          if (
            parsed.origin === window.location.origin &&
            !parsed.pathname.startsWith('/api/') &&
            !parsed.pathname.startsWith('/_next/webpack-hmr') &&
            parsed.pathname !== '/sw.js'
          ) {
            urls.add(parsed.href);
          }
        } catch {
          // Ignore invalid URL
        }
      }
    } catch {
      // Ignore performance API errors
    }
  }

  return Array.from(urls);
}

export async function warmOfflineAppCache(
  extraUrls: string[] = [],
  forceReloadPages: boolean = false
): Promise<OfflineCacheStatus | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) return null;

    if (!navigator.serviceWorker.controller && registration.active) {
      registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
    }

    const urls = collectRuntimeAssetUrls(extraUrls);
    return await new Promise<OfflineCacheStatus | null>((resolve) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(async () => {
        const direct = await getOfflineCacheStatus();
        resolve(direct);
      }, 6500);
      channel.port1.onmessage = (ev) => {
        clearTimeout(timeout);
        const data = ev.data as { ready?: boolean; cachedCount?: number; cacheName?: string };
        resolve({
          ready: data?.ready !== false,
          controlled: Boolean(navigator.serviceWorker.controller),
          cachedCount: data?.cachedCount || urls.length,
          cacheName: data?.cacheName || 'offnex-ai-shell-v7',
        });
      };
      worker.postMessage(
        { type: forceReloadPages ? 'FORCE_REFRESH_CACHE' : 'CACHE_URLS', urls },
        [channel.port2]
      );
    });
  } catch {
    return null;
  }
}

export async function checkServiceWorkerUpdate(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.onLine) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    await reg?.update();
  } catch {
    // Ignore update check failure
  }
}

export async function getOfflineCacheStatus(): Promise<OfflineCacheStatus | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const controlled = Boolean(navigator.serviceWorker.controller);

  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (worker) {
      const pingResult = await new Promise<OfflineCacheStatus | null>((resolve) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(null), 2500);
        channel.port1.onmessage = (ev) => {
          clearTimeout(timeout);
          const data = ev.data as { ready?: boolean; cachedCount?: number; cacheName?: string };
          resolve({
            ready: Boolean(data?.ready),
            controlled: Boolean(navigator.serviceWorker.controller),
            cachedCount: data?.cachedCount || 0,
            cacheName: data?.cacheName || 'offnex-ai-shell-v7',
          });
        };
        worker.postMessage({ type: 'PING_CACHE_STATUS' }, [channel.port2]);
      });
      if (pingResult) return pingResult;
    }
  } catch {
    // Fall back to reading CacheStorage directly
  }

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const targetName = cacheNames.find((n) => n.startsWith('offnex-ai-shell')) || 'offnex-ai-shell-v7';
      const cache = await caches.open(targetName);
      const keys = await cache.keys();
      const rootMatch = await cache.match('/', { ignoreSearch: true });
      return {
        ready: Boolean(rootMatch),
        controlled,
        cachedCount: keys.length,
        cacheName: targetName,
      };
    }
  } catch {
    // Ignore CacheStorage errors
  }
  return null;
}

export function initPWAListeners() {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  globalInstalled = isStandalone;

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  };

  const handleAppInstalled = () => {
    globalInstalled = true;
    globalDeferredPrompt = null;
    if (navigator.onLine) {
      void warmOfflineAppCache([], true);
    }
    notifySubscribers();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Register Service Worker early, auto-activate new versions, claim clients, and warm offline shell cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        if (!navigator.serviceWorker.controller && registration.active) {
          registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        registration.update().catch(() => undefined);
        if (navigator.onLine) {
          setTimeout(() => {
            void warmOfflineAppCache();
          }, 500);
        }
      })
      .catch(() => {
        // Ignore registration issues in restricted environments
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (navigator.onLine) {
        void warmOfflineAppCache([], true);
      }
      notifySubscribers();
    });
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => globalInstalled);
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    initPWAListeners();

    const syncState = () => {
      setDeferredPrompt(globalDeferredPrompt);
      const standalone =
        globalInstalled ||
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      setIsEmbedded(true);
    }

    syncState();
    subscribers.add(syncState);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        globalInstalled = true;
        syncState();
      }
    };
    mediaQuery.addEventListener?.('change', handleMediaChange);

    return () => {
      subscribers.delete(syncState);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent = globalDeferredPrompt || deferredPrompt;
    if (!promptEvent) {
      return 'unavailable';
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        globalInstalled = true;
        globalDeferredPrompt = null;
        if (navigator.onLine) {
          void warmOfflineAppCache([], true);
        }
        notifySubscribers();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    platform,
    isEmbedded,
    install,
  };
}
