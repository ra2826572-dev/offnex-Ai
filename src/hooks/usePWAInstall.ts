'use client';

import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

// Global store so `beforeinstallprompt` is never lost before opening Settings
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstalled = false;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
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
    notifySubscribers();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Register Service Worker so Chrome / Edge / Android qualify the site as an installable PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Ignore registration issues in restricted environments
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
