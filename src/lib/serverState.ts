import { getConfiguredImageModel } from './imageProvider';

export interface ServerActivityLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  actor?: string;
}

export interface ServerRuntimeConfig {
  defaultChatModel: string;
  defaultImageModel: string;
  highQualityImageModel: string;
  imageRateLimitMax: number;
  imageRateLimitWindowMinutes: number;
  maintenanceMode: boolean;
  allowLocalFallback: boolean;
  ollamaHost: string;
}

interface GlobalAdminStore {
  serverStartedAt: number;
  serverActivityLogs: ServerActivityLog[];
  imageRateLimitMap: Map<string, number[]>;
  adminRuntimeConfig: ServerRuntimeConfig;
}

const IMAGE_RATE_LIMIT_MAX = 10;
const IMAGE_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SERVER_LOGS = 200;

const globalForOffnex = globalThis as typeof globalThis & {
  __offnexServerStore?: GlobalAdminStore;
};

function getStore(): GlobalAdminStore {
  if (!globalForOffnex.__offnexServerStore) {
    globalForOffnex.__offnexServerStore = {
      serverStartedAt: Date.now(),
      serverActivityLogs: [
        {
          id: `srv-boot-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          category: 'system',
          message: 'Offnex AI Next.js server initialized',
          actor: 'system',
        },
      ],
      imageRateLimitMap: new Map<string, number[]>(),
      adminRuntimeConfig: {
        defaultChatModel: process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.1-flash-lite',
        defaultImageModel: getConfiguredImageModel('standard'),
        highQualityImageModel: getConfiguredImageModel('high'),
        imageRateLimitMax: IMAGE_RATE_LIMIT_MAX,
        imageRateLimitWindowMinutes: Math.round(IMAGE_RATE_LIMIT_WINDOW_MS / 60000),
        maintenanceMode: false,
        allowLocalFallback: true,
        ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
      },
    };
  }
  return globalForOffnex.__offnexServerStore;
}

export function getServerStartedAt(): number {
  return getStore().serverStartedAt;
}

export function getAdminRuntimeConfig(): ServerRuntimeConfig {
  return getStore().adminRuntimeConfig;
}

export function updateAdminRuntimeConfig(
  body: Partial<ServerRuntimeConfig>
): ServerRuntimeConfig {
  const cfg = getStore().adminRuntimeConfig;
  if (typeof body.defaultChatModel === 'string' && body.defaultChatModel.trim()) {
    cfg.defaultChatModel = body.defaultChatModel.trim();
  }
  if (typeof body.defaultImageModel === 'string' && body.defaultImageModel.trim()) {
    cfg.defaultImageModel = body.defaultImageModel.trim();
  }
  if (typeof body.highQualityImageModel === 'string' && body.highQualityImageModel.trim()) {
    cfg.highQualityImageModel = body.highQualityImageModel.trim();
  }
  if (typeof body.imageRateLimitMax === 'number' && Number.isFinite(body.imageRateLimitMax)) {
    cfg.imageRateLimitMax = Math.min(200, Math.max(1, Math.floor(body.imageRateLimitMax)));
  }
  if (
    typeof body.imageRateLimitWindowMinutes === 'number' &&
    Number.isFinite(body.imageRateLimitWindowMinutes)
  ) {
    cfg.imageRateLimitWindowMinutes = Math.min(
      1440,
      Math.max(1, Math.floor(body.imageRateLimitWindowMinutes))
    );
  }
  if (typeof body.maintenanceMode === 'boolean') {
    cfg.maintenanceMode = body.maintenanceMode;
  }
  if (typeof body.allowLocalFallback === 'boolean') {
    cfg.allowLocalFallback = body.allowLocalFallback;
  }
  if (typeof body.ollamaHost === 'string' && body.ollamaHost.trim()) {
    cfg.ollamaHost = body.ollamaHost.trim().replace(/\/+$/, '');
  }
  return cfg;
}

export function pushServerLog(
  level: 'info' | 'warn' | 'error',
  category: string,
  message: string,
  actor?: string
): void {
  const store = getStore();
  store.serverActivityLogs.unshift({
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    actor,
  });
  if (store.serverActivityLogs.length > MAX_SERVER_LOGS) {
    store.serverActivityLogs.length = MAX_SERVER_LOGS;
  }
}

export function getServerLogs(): ServerActivityLog[] {
  return getStore().serverActivityLogs;
}

export function clearServerLogs(): ServerActivityLog[] {
  const store = getStore();
  store.serverActivityLogs.length = 0;
  pushServerLog('info', 'admin', 'Server activity logs cleared by admin', 'admin');
  return store.serverActivityLogs;
}

export function getRemainingImageQuota(key: string): {
  remaining: number;
  limit: number;
  resetMs: number;
} {
  const store = getStore();
  const now = Date.now();
  const maxAllowed = store.adminRuntimeConfig.imageRateLimitMax;
  const windowMs = store.adminRuntimeConfig.imageRateLimitWindowMinutes * 60 * 1000;
  const timestamps = (store.imageRateLimitMap.get(key) || []).filter(
    (ts) => now - ts < windowMs
  );
  store.imageRateLimitMap.set(key, timestamps);
  const oldest = timestamps[0] ?? now;
  return {
    remaining: Math.max(0, maxAllowed - timestamps.length),
    limit: maxAllowed,
    resetMs: timestamps.length > 0 ? Math.max(0, windowMs - (now - oldest)) : 0,
  };
}

export function consumeImageQuota(
  key: string,
  count: number = 1
): {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
} {
  const store = getStore();
  const status = getRemainingImageQuota(key);
  const units = Math.max(1, Math.floor(count));
  if (status.remaining < units) {
    return { allowed: false, ...status };
  }
  const timestamps = store.imageRateLimitMap.get(key) || [];
  const now = Date.now();
  for (let i = 0; i < units; i++) {
    timestamps.push(now);
  }
  store.imageRateLimitMap.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, status.remaining - units),
    limit: status.limit,
    resetMs: status.resetMs,
  };
}
