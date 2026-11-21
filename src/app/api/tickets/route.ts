import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBackendTicket,
  listBackendTickets,
  saveBackendTicket,
} from '@/lib/backendDb';
import { getRequestUserMeta, isTrustedSameOrigin } from '@/lib/requestAuth';
import type { SupportTicket } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === '1';
  const meta = getRequestUserMeta(req);
  const userId = all ? undefined : searchParams.get('userId') || meta.userId;
  const userEmail = all ? undefined : searchParams.get('userEmail') || meta.userEmail;

  return NextResponse.json({
    tickets: listBackendTickets(userId, userEmail),
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const meta = getRequestUserMeta(req);
  const body = (await req.json().catch(() => ({}))) as {
    ticket?: Partial<SupportTicket>;
  } & Partial<SupportTicket>;
  const rawTicket: Partial<SupportTicket> = body.ticket || body;

  const isExistingUpdate =
    Boolean(rawTicket.id) &&
    listBackendTickets().some((t) => t.id === rawTicket.id);

  if (!isExistingUpdate && !rawTicket.subject?.trim()) {
    return NextResponse.json({ error: 'Ticket subject is required.' }, { status: 400 });
  }

  const saved = saveBackendTicket({
    ...rawTicket,
    userId: rawTicket.userId || meta.userId,
    userEmail: rawTicket.userEmail || meta.userEmail,
    userName: rawTicket.userName || meta.userName,
  });

  return NextResponse.json({ ok: true, ticket: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Ticket ID is required.' }, { status: 400 });
  }

  const deleted = deleteBackendTicket(id);
  return NextResponse.json({ ok: true, deleted });
}
