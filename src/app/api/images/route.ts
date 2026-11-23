import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBackendImageRecord,
  listBackendImages,
  saveBackendImageRecord,
} from '@/lib/backendDb';
import { getRequestUserMeta, isTrustedSameOrigin } from '@/lib/requestAuth';
import type { GeneratedImageRecord } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === '1';
  const meta = getRequestUserMeta(req);
  const userId = all ? undefined : searchParams.get('userId') || meta.userId;
  const userEmail = all ? undefined : searchParams.get('userEmail') || meta.userEmail;

  return NextResponse.json({
    images: listBackendImages(
      userId || userEmail ? { userId, userEmail } : undefined
    ),
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const meta = getRequestUserMeta(req);
  const body = (await req.json().catch(() => ({}))) as {
    record?: GeneratedImageRecord;
  };

  if (!body.record || !body.record.id) {
    return NextResponse.json({ error: 'Valid image record is required.' }, { status: 400 });
  }

  const saved = saveBackendImageRecord({
    ...body.record,
    userId: body.record.userId || meta.userId || 'anonymous',
    userEmail: body.record.userEmail || meta.userEmail,
    userName: body.record.userName || meta.userName,
  });

  return NextResponse.json({ ok: true, record: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const scopeUserId = searchParams.get('userId') || undefined;

  if (!id) {
    return NextResponse.json({ error: 'Image record ID is required.' }, { status: 400 });
  }

  const deleted = deleteBackendImageRecord(id, scopeUserId);
  return NextResponse.json({ ok: true, deleted });
}
