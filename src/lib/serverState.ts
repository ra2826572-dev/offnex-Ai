import {
  appendBackendLog,
  clearBackendLogs,
  consumeBackendImageQuota,
  getBackendLogs,
  getBackendRemainingImageQuota,
  getBackendRuntimeConfig,
  updateBackendRuntimeConfig,
} from './backendDb';
import type { AdminActivityLog, AdminRuntimeConfig } from '@/types';

export type ServerActivityLog = AdminActivityLog;
export type ServerRuntimeConfig = AdminRuntimeConfig;

const globalForServerStart = globalThis as typeof globalThis & {
  __offnexServerStartedAt?: number;
};

export function getServerStartedAt(): number {
  if (!globalForServerStart.__offnexServerStartedAt) {
    globalForServerStart.__offnexServerStartedAt = Date.now();
  }
  return globalForServerStart.__offnexServerStartedAt;
}

export function getAdminRuntimeConfig(): ServerRuntimeConfig {
  return getBackendRuntimeConfig();
}

export function updateAdminRuntimeConfig(
  body: Partial<ServerRuntimeConfig>
): ServerRuntimeConfig {
  return updateBackendRuntimeConfig(body);
}

export function pushServerLog(
  level: 'info' | 'warn' | 'error',
  category: string,
  message: string,
  actor?: string
): void {
  appendBackendLog(level, category, message, actor, 'server');
}

export function getServerLogs(): ServerActivityLog[] {
  return getBackendLogs();
}

export function clearServerLogs(): ServerActivityLog[] {
  return clearBackendLogs();
}

export function getRemainingImageQuota(key: string): {
  remaining: number;
  limit: number;
  resetMs: number;
} {
  return getBackendRemainingImageQuota(key);
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
  return consumeBackendImageQuota(key, count);
}
