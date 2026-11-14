import { NextResponse } from 'next/server';
import { getAdminRuntimeConfig } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const host = getAdminRuntimeConfig().ollamaHost;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${host}/api/version`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = (await response.json()) as { version?: string };
      return NextResponse.json({ connected: true, version: data.version, host });
    }
    return NextResponse.json({
      connected: false,
      host,
      message: 'Ollama is not running on localhost:11434',
    });
  } catch {
    return NextResponse.json({ connected: false, host, message: 'Connection refused' });
  }
}
