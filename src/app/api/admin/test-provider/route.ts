import { NextRequest, NextResponse } from 'next/server';
import {
  LocalSDImageProvider,
  resolveImageApiKey,
  verifyGeminiImageModelAccess,
} from '@/lib/imageProvider';
import { getAdminRuntimeConfig, pushServerLog } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const provider = String(body?.provider || 'gemini');
  const config = getAdminRuntimeConfig();

  if (provider === 'gemini') {
    const { apiKey } = resolveImageApiKey();
    if (!apiKey) {
      pushServerLog('warn', 'provider', 'Tested Gemini provider: API key missing', 'admin');
      return NextResponse.json({
        ok: false,
        message: 'GEMINI_API_KEY is not configured in server environment.',
      });
    }
    const check = await verifyGeminiImageModelAccess(apiKey, config.defaultImageModel);
    pushServerLog(
      check.valid ? 'info' : 'error',
      'provider',
      check.valid
        ? `Gemini connectivity check passed (${config.defaultImageModel})`
        : `Gemini connectivity check failed: ${check.error}`,
      'admin'
    );
    return NextResponse.json({
      ok: check.valid,
      message: check.valid
        ? `Connected (${config.defaultImageModel} reachable)`
        : check.error || 'Model check failed',
    });
  }

  if (provider === 'ollama') {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`${config.ollamaHost}/api/version`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(tid);
      if (resp && resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { version?: string };
        pushServerLog('info', 'provider', `Ollama test succeeded (v${data.version || 'unknown'})`, 'admin');
        return NextResponse.json({
          ok: true,
          message: `Ollama online (v${data.version || 'unknown'})`,
        });
      }
    } catch {
      // offline
    }
    pushServerLog('warn', 'provider', `Ollama unreachable at ${config.ollamaHost}`, 'admin');
    return NextResponse.json({
      ok: false,
      message: `Ollama is offline at ${config.ollamaHost}`,
    });
  }

  if (provider === 'local-sd') {
    const localProvider = new LocalSDImageProvider();
    const status = await localProvider.getStatus();
    pushServerLog(
      status.available ? 'info' : 'warn',
      'provider',
      status.available
        ? `Local SD online (${status.modelsCount} checkpoints)`
        : `Local SD unreachable: ${status.error || 'offline'}`,
      'admin'
    );
    return NextResponse.json({
      ok: status.available,
      message: status.available
        ? `Connected (${status.modelsCount} checkpoints)`
        : status.error || 'Local Stable Diffusion is offline',
    });
  }

  return NextResponse.json({ ok: false, message: 'Unknown provider target' }, { status: 400 });
}
