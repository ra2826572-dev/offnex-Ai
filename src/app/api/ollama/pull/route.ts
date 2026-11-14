import { NextRequest, NextResponse } from 'next/server';
import { getAdminRuntimeConfig } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const host = getAdminRuntimeConfig().ollamaHost;
  try {
    const body = await req.json();
    const response = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to pull model' }, { status: response.status });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || 'Failed to pull' }, { status: 503 });
  }
}
