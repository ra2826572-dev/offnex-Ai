import { NextResponse } from 'next/server';
import { getAdminRuntimeConfig } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const host = getAdminRuntimeConfig().ollamaHost;
  try {
    const response = await fetch(`${host}/api/tags`);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Ollama offline or unreachable' }, { status: 503 });
  }
}
