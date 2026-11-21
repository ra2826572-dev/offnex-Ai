import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBackendDocument,
  listBackendDocuments,
  saveBackendDocument,
} from '@/lib/backendDb';
import { getRequestUserMeta, isTrustedSameOrigin } from '@/lib/requestAuth';
import type { StoredDocument } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === '1';
  const meta = getRequestUserMeta(req);
  const userId = all ? undefined : searchParams.get('userId') || meta.userId;

  return NextResponse.json({
    documents: listBackendDocuments(userId),
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const meta = getRequestUserMeta(req);
  const body = (await req.json().catch(() => ({}))) as { document?: StoredDocument };
  if (!body.document || !body.document.id) {
    return NextResponse.json({ error: 'Valid document is required.' }, { status: 400 });
  }

  const saved = saveBackendDocument({
    ...body.document,
    userId: body.document.userId || meta.userId,
    userEmail: body.document.userEmail || meta.userEmail,
  });

  return NextResponse.json({ ok: true, document: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
  }

  const deleted = deleteBackendDocument(id);
  return NextResponse.json({ ok: true, deleted });
}
