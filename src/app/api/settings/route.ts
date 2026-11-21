import { NextRequest, NextResponse } from 'next/server';
import {
  getBackendSystemSettings,
  updateBackendSystemSettings,
} from '@/lib/backendDb';
import { getRequestUserMeta, isTrustedSameOrigin } from '@/lib/requestAuth';
import type { AppSettings } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ settings: getBackendSystemSettings() });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const meta = getRequestUserMeta(req);
  const body = (await req.json().catch(() => ({}))) as Partial<AppSettings>;
  const updated = updateBackendSystemSettings(
    body,
    meta.userEmail || meta.userId || 'admin'
  );
  return NextResponse.json({ ok: true, settings: updated });
}
