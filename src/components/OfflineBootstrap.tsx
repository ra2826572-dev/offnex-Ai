'use client';

import { useEffect, useRef } from 'react';
import {
  checkServiceWorkerUpdate,
  initPWAListeners,
  warmOfflineAppCache,
} from '@/hooks/usePWAInstall';
import { fetchLiveSyncState } from '@/services/backendSync';

const APP_VERSION_KEY = 'offnex_known_app_version';

declare global {
  interface Window {
    __offnexBusyGenerating?: boolean;
    __offnexPendingReload?: boolean;
  }
}

export function OfflineBootstrap() {
  const checkingRef = useRef(false);
  const reloadingRef = useRef(false);

  useEffect(() => {
    initPWAListeners();

    const checkAppUpdateAndCache = async () => {
      if (checkingRef.current || reloadingRef.current) return;
      if (typeof navigator === 'undefined' || !navigator.onLine) return;
      checkingRef.current = true;

      try {
        await checkServiceWorkerUpdate();
        const live = await fetchLiveSyncState();
        if (!live?.appVersion) return;

        let knownVersion: string | null = null;
        try {
          knownVersion = localStorage.getItem(APP_VERSION_KEY);
        } catch {
          // Ignore storage error
        }

        if (!knownVersion) {
          try {
            localStorage.setItem(APP_VERSION_KEY, live.appVersion);
          } catch {
            // Ignore
          }
          void warmOfflineAppCache();
          return;
        }

        if (knownVersion !== live.appVersion) {
          try {
            localStorage.setItem(APP_VERSION_KEY, live.appVersion);
          } catch {
            // Ignore
          }

          window.dispatchEvent(new CustomEvent('offnex:app-updating', { detail: live }));
          const refreshed = await warmOfflineAppCache([], true);

          if (!navigator.onLine || !refreshed?.ready) {
            return;
          }

          if (window.__offnexBusyGenerating) {
            window.__offnexPendingReload = true;
            return;
          }

          reloadingRef.current = true;
          setTimeout(() => {
            if (navigator.onLine) {
              window.location.reload();
            } else {
              reloadingRef.current = false;
            }
          }, 500);
        }
      } finally {
        checkingRef.current = false;
      }
    };

    const syncCache = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        void warmOfflineAppCache();
        void checkAppUpdateAndCache();
      }
    };

    if (document.readyState === 'complete') {
      syncCache();
    } else {
      window.addEventListener('load', syncCache, { once: true });
    }

    const onFocus = () => void checkAppUpdateAndCache();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkAppUpdateAndCache();
      }
    };

    const onSwMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'SW_ACTIVATED' && navigator.onLine) {
        void warmOfflineAppCache([], true);
      }
    };

    window.addEventListener('online', syncCache);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void checkAppUpdateAndCache();
      }
    }, 20000);

    return () => {
      window.removeEventListener('load', syncCache);
      window.removeEventListener('online', syncCache);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      clearInterval(interval);
    };
  }, []);

  return null;
}
