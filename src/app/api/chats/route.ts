import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBackendConversation,
  listBackendConversations,
  listBackendMessages,
  upsertBackendConversation,
  upsertBackendMessages,
} from '@/lib/backendDb';
import { getRequestUserMeta, isTrustedSameOrigin } from '@/lib/requestAuth';
import type { Conversation, Message } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === '1';
  const conversationId = searchParams.get('conversationId') || undefined;
  const meta = getRequestUserMeta(req);
  const userId = all ? undefined : searchParams.get('userId') || meta.userId;

  if (conversationId) {
    return NextResponse.json({
      messages: listBackendMessages({ conversationId }),
    });
  }

  return NextResponse.json({
    conversations: listBackendConversations(userId),
    messages: listBackendMessages(userId ? { userId } : undefined),
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const meta = getRequestUserMeta(req);
  const body = (await req.json().catch(() => ({}))) as {
    conversation?: Conversation;
    message?: Message;
    messages?: Message[];
  };

  let savedConv: Conversation | undefined;
  if (body.conversation && body.conversation.id) {
    savedConv = upsertBackendConversation({
      ...body.conversation,
      userId: body.conversation.userId || meta.userId,
      userEmail: body.conversation.userEmail || meta.userEmail,
      userName: body.conversation.userName || meta.userName,
    });
  }

  const incomingMessages: Message[] = [];
  if (body.message && body.message.id) {
    incomingMessages.push(body.message);
  }
  if (Array.isArray(body.messages)) {
    incomingMessages.push(...body.messages);
  }

  const enrichedMsgs = incomingMessages.map((m) => ({
    ...m,
    userId: m.userId || meta.userId,
  }));

  const savedMessages =
    enrichedMsgs.length > 0 ? upsertBackendMessages(enrichedMsgs) : [];

  return NextResponse.json({
    ok: true,
    conversation: savedConv,
    messages: savedMessages,
  });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 });
  }

  const deleted = deleteBackendConversation(id);
  return NextResponse.json({ ok: true, deleted });
}
