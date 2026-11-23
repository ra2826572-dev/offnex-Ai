import type {
  AdminActivityLog,
  AdminBootstrapResponse,
  AppSettings,
  Conversation,
  GeneratedImageRecord,
  LiveSyncSnapshot,
  Message,
  StoredDocument,
  SupportTicket,
} from '@/types';

function isOnline(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine;
}

export async function syncConversationToBackend(
  conversation?: Conversation,
  messages?: Message[]
): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch('/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(conversation?.userId ? { 'x-user-id': conversation.userId } : {}),
        ...(conversation?.userEmail ? { 'x-user-email': conversation.userEmail } : {}),
      },
      body: JSON.stringify({ conversation, messages }),
    });
  } catch {
    // Graceful offline fallback — IndexedDB retains local data
  }
}

export async function deleteConversationOnBackend(id: string): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch(`/api/chats?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // Ignore offline error
  }
}

export async function fetchUserChatsFromBackend(
  userId: string,
  userEmail?: string
): Promise<{ conversations: Conversation[]; messages: Message[] } | null> {
  if (!isOnline() || (!userId && !userEmail)) return null;
  try {
    const qs = new URLSearchParams();
    if (userId) qs.set('userId', userId);
    if (userEmail) qs.set('userEmail', userEmail);
    const res = await fetch(`/api/chats?${qs.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as { conversations: Conversation[]; messages: Message[] };
  } catch {
    return null;
  }
}

export async function syncImageRecordToBackend(record: GeneratedImageRecord): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch('/api/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(record.userId ? { 'x-user-id': record.userId } : {}),
        ...(record.userEmail ? { 'x-user-email': record.userEmail } : {}),
      },
      body: JSON.stringify({ record }),
    });
  } catch {
    // Graceful offline fallback
  }
}

export async function deleteImageRecordOnBackend(id: string, userId?: string): Promise<void> {
  if (!isOnline()) return;
  try {
    const qs = new URLSearchParams({ id });
    if (userId) qs.set('userId', userId);
    await fetch(`/api/images?${qs.toString()}`, { method: 'DELETE' });
  } catch {
    // Ignore offline error
  }
}

export async function fetchUserImagesFromBackend(
  userId: string,
  userEmail?: string
): Promise<GeneratedImageRecord[] | null> {
  if (!isOnline() || (!userId && !userEmail)) return null;
  try {
    const qs = new URLSearchParams();
    if (userId) qs.set('userId', userId);
    if (userEmail) qs.set('userEmail', userEmail);
    const res = await fetch(`/api/images?${qs.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { images?: GeneratedImageRecord[] };
    return Array.isArray(data.images) ? data.images : [];
  } catch {
    return null;
  }
}

export async function syncDocumentToBackend(doc: StoredDocument): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch('/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(doc.userId ? { 'x-user-id': doc.userId } : {}),
      },
      body: JSON.stringify({ document: doc }),
    });
  } catch {
    // Ignore offline error
  }
}

export async function syncSettingsToBackend(settings: AppSettings): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch {
    // Ignore offline error
  }
}

export async function fetchSettingsFromBackend(): Promise<AppSettings | null> {
  if (!isOnline()) return null;
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { settings?: AppSettings };
    return data.settings || null;
  } catch {
    return null;
  }
}

export async function saveTicketToBackend(ticket: SupportTicket): Promise<SupportTicket | null> {
  if (!isOnline()) return null;
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ticket?: SupportTicket };
    return data.ticket || null;
  } catch {
    return null;
  }
}

export async function deleteTicketOnBackend(id: string): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch(`/api/tickets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // Ignore
  }
}

export async function fetchUserTicketsFromBackend(
  userId?: string,
  userEmail?: string
): Promise<SupportTicket[] | null> {
  if (!isOnline()) return null;
  try {
    const qs = new URLSearchParams();
    if (userId) qs.set('userId', userId);
    if (userEmail) qs.set('userEmail', userEmail);
    const res = await fetch(`/api/tickets?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { tickets?: SupportTicket[] };
    return Array.isArray(data.tickets) ? data.tickets : [];
  } catch {
    return null;
  }
}

export async function pushActivityLogToBackend(
  entry: Omit<AdminActivityLog, 'id' | 'timestamp'>
): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetch('/api/admin/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // Ignore
  }
}

export async function fetchAdminBootstrapFromBackend(): Promise<AdminBootstrapResponse | null> {
  if (!isOnline()) return null;
  try {
    const res = await fetch('/api/admin/bootstrap', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as AdminBootstrapResponse;
  } catch {
    return null;
  }
}

export async function fetchLiveSyncState(
  userId?: string,
  email?: string
): Promise<LiveSyncSnapshot | null> {
  if (!isOnline()) return null;
  try {
    const qs = new URLSearchParams();
    if (userId) qs.set('userId', userId);
    if (email) qs.set('email', email);
    const query = qs.toString();
    const res = await fetch(`/api/sync/live${query ? `?${query}` : ''}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as LiveSyncSnapshot;
  } catch {
    return null;
  }
}

