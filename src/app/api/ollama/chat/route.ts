import { NextRequest, NextResponse } from 'next/server';
import { getAdminRuntimeConfig } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const host = getAdminRuntimeConfig().ollamaHost;
  try {
    const body = await req.json();
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText }, { status: response.status });
    }

    if (body?.stream === false) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Ollama connection failed' },
      { status: 503 }
    );
  }
}
