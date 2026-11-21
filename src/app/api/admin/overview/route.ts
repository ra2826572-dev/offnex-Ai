import { NextResponse } from 'next/server';
import os from 'os';
import {
  LocalSDImageProvider,
  OpenAIImageProvider,
  resolveImageApiKey,
} from '@/lib/imageProvider';
import { resolveGeminiChatApiKey } from '@/lib/geminiKey';
import {
  getAdminRuntimeConfig,
  getServerLogs,
  getServerStartedAt,
} from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const totalMem = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
  const freeMem = Math.round((os.freemem() / (1024 * 1024 * 1024)) * 10) / 10;
  const cpus = os.cpus();

  const config = getAdminRuntimeConfig();
  const { apiKey: imageApiKey, source: imageKeySource } = resolveImageApiKey();
  const { apiKey: chatApiKey } = resolveGeminiChatApiKey();
  const geminiChatConfigured = Boolean(chatApiKey);
  const openaiProvider = new OpenAIImageProvider();
  const openaiConfigured = openaiProvider.isConfigured();
  const localProvider = new LocalSDImageProvider();

  const ollamaStatusPromise = (async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 1500);
      const resp = await fetch(`${config.ollamaHost}/api/version`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(tid);
      if (resp && resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { version?: string };
        return { connected: true, version: data.version || 'unknown', host: config.ollamaHost };
      }
    } catch {
      // ignore offline Ollama
    }
    return { connected: false, version: undefined, host: config.ollamaHost };
  })();

  const [localSdStatus, ollamaStatus] = await Promise.all([
    localProvider.getStatus(),
    ollamaStatusPromise,
  ]);

  return NextResponse.json({
    hardware: {
      platform: os.platform(),
      arch: os.arch(),
      totalMemGb: totalMem,
      freeMemGb: freeMem,
      usedMemGb: Math.max(0, Math.round((totalMem - freeMem) * 10) / 10),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Generic CPU',
      uptimeSec: Math.round((Date.now() - getServerStartedAt()) / 1000),
      nodeVersion: process.version,
    },
    providers: {
      geminiChat: {
        configured: geminiChatConfigured,
        model: config.defaultChatModel,
        status: geminiChatConfigured ? 'online' : 'unconfigured',
      },
      geminiImage: {
        configured: Boolean(imageApiKey),
        keySource: imageKeySource,
        modelStandard: config.defaultImageModel,
        modelHigh: config.highQualityImageModel,
        status: imageApiKey ? 'online' : 'unconfigured',
      },
      openai: {
        configured: openaiConfigured,
        model: 'dall-e-3',
        status: openaiConfigured ? 'online' : 'unconfigured',
      },
      ollama: {
        connected: ollamaStatus.connected,
        version: ollamaStatus.version,
        host: ollamaStatus.host,
        status: ollamaStatus.connected ? 'online' : 'offline',
      },
      localSd: {
        available: localSdStatus.available,
        endpoint: localSdStatus.endpoint,
        modelsCount: localSdStatus.modelsCount,
        error: localSdStatus.error,
        status: localSdStatus.available ? 'online' : 'offline',
      },
    },
    config,
    logs: getServerLogs().slice(0, 60),
  });
}
