import { NextRequest, NextResponse } from 'next/server';
import {
  appendBackendLog,
  clearBackendLogs,
  getBackendLogs,
} from '@/lib/backendDb';
import { isTrustedSameOrigin } from '@/lib/requestAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ logs: getBackendLogs() });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    level?: 'info' | 'warn' | 'error';
    category?: string;
    message?: string;
    actor?: string;
    source?: 'client' | 'server';
  };

  if (!body.message || !body.message.trim()) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }

  const entry = appendBackendLog(
    body.level === 'error' || body.level === 'warn' ? body.level : 'info',
    String(body.category || 'system').slice(0, 32),
    body.message.trim().slice(0, 500),
    body.actor ? String(body.actor).slice(0, 120) : undefined,
    body.source === 'client' ? 'client' : 'server'
  );

  return NextResponse.json({ ok: true, log: entry });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }
  const logs = clearBackendLogs();
  return NextResponse.json({ ok: true, logs });
}
