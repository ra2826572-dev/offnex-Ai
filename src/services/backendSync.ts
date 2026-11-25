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

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = 3500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function syncConversationToBackend(
  conversation?: Conversation,
  messages?: Message[]
): Promise<void> {
  if (!isOnline()) return;
  try {
    await fetchWithTimeout('/api/chats', {
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
    await fetchWithTimeout(`/api/chats?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    const res = await fetchWithTimeout(`/api/chats?${qs.toString()}`, {
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
    await fetchWithTimeout('/api/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(record.userId ? { 'x-user-id': record.userId } : {}),
        ...(record.userEmail ? { 'x-user-email': record.userEmail } : {}),
      },
      body: JSON.stringify({ record }),
    }, 6000);
  } catch {
    // Graceful offline fallback
  }
}

export async function deleteImageRecordOnBackend(id: string, userId?: string): Promise<void> {
  if (!isOnline()) return;
  try {
    const qs = new URLSearchParams({ id });
    if (userId) qs.set('userId', userId);
    await fetchWithTimeout(`/api/images?${qs.toString()}`, { method: 'DELETE' });
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
    const res = await fetchWithTimeout(`/api/images?${qs.toString()}`, {
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
    await fetchWithTimeout('/api/documents', {
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
    await fetchWithTimeout('/api/settings', {
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
    const res = await fetchWithTimeout('/api/settings', { cache: 'no-store' });
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
    const res = await fetchWithTimeout('/api/tickets', {
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
    await fetchWithTimeout(`/api/tickets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    const res = await fetchWithTimeout(`/api/tickets?${qs.toString()}`, { cache: 'no-store' });
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
    await fetchWithTimeout('/api/admin/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // Ignore
  }
}

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 4500);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAdminBootstrapFromBackend(): Promise<AdminBootstrapResponse | null> {
  if (!isOnline()) return null;
  try {
    const res = await fetchWithTimeout('/api/admin/bootstrap', { cache: 'no-store' }, 5000);
    if (res.ok) {
      const data = (await res.json()) as AdminBootstrapResponse;
      if (data && Array.isArray(data.users) && Array.isArray(data.images)) {
        return data;
      }
    }
  } catch {
    // Fall through to individual lightweight endpoints
  }

  try {
    const [usersRes, chatsRes, imgsRes, docsRes, settingsRes, ticketsRes, logsRes, overviewRes] =
      await Promise.all([
        fetchJsonSafe<{ users?: AdminBootstrapResponse['users'] }>('/api/admin/users'),
        fetchJsonSafe<{
          conversations?: AdminBootstrapResponse['conversations'];
          messages?: AdminBootstrapResponse['messages'];
        }>('/api/chats?all=1'),
        fetchJsonSafe<{ images?: AdminBootstrapResponse['images'] }>('/api/images?all=1&compact=1'),
        fetchJsonSafe<{ documents?: AdminBootstrapResponse['documents'] }>('/api/documents?all=1'),
        fetchJsonSafe<{ settings?: AdminBootstrapResponse['settings'] }>('/api/settings'),
        fetchJsonSafe<{ tickets?: AdminBootstrapResponse['tickets'] }>('/api/tickets'),
        fetchJsonSafe<{ logs?: AdminBootstrapResponse['logs'] }>('/api/admin/logs'),
        fetchJsonSafe<AdminBootstrapResponse['overview']>('/api/admin/overview'),
      ]);

    const gotAnyCoreData = Boolean(usersRes || chatsRes || imgsRes || overviewRes);
    if (!gotAnyCoreData) return null;

    return {
      users: Array.isArray(usersRes?.users) ? usersRes.users : [],
      conversations: Array.isArray(chatsRes?.conversations) ? chatsRes.conversations : [],
      messages: Array.isArray(chatsRes?.messages) ? chatsRes.messages : [],
      images: Array.isArray(imgsRes?.images) ? imgsRes.images : [],
      documents: Array.isArray(docsRes?.documents) ? docsRes.documents : [],
      settings: settingsRes?.settings || {
        language: 'ur',
        theme: 'dark',
        defaultModel: 'gemini-3.1-flash-lite',
        ollamaHost: 'http://localhost:11434',
        temperature: 0.7,
        contextWindow: 4096,
        speechSpeed: 1.0,
        ttsVoice: 'default',
        offlineStrict: true,
        autoSaveHistory: true,
        enableSoundEffects: true,
      },
      tickets: Array.isArray(ticketsRes?.tickets) ? ticketsRes.tickets : [],
      logs: Array.isArray(logsRes?.logs) ? logsRes.logs : overviewRes?.logs || [],
      overview: overviewRes || {
        providers: {
          geminiChat: {
            configured: false,
            model: 'gemini-3.1-flash-lite',
            status: 'unconfigured',
          },
          geminiImage: {
            configured: false,
            keySource: 'none',
            modelStandard: 'gemini-2.5-flash-image',
            modelHigh: 'gemini-nano-banana-2.1',
            status: 'unconfigured',
          },
          openai: { configured: false, model: 'dall-e-3', status: 'unconfigured' },
          ollama: { connected: false, host: 'http://localhost:11434', status: 'offline' },
          localSd: {
            available: false,
            endpoint: 'http://127.0.0.1:7860',
            modelsCount: 0,
            status: 'offline',
          },
        },
        hardware: {
          platform: 'web',
          arch: 'x64',
          nodeVersion: '',
          cpuCount: 1,
          cpuModel: 'server',
          totalMemGb: 0,
          freeMemGb: 0,
          usedMemGb: 0,
          uptimeSec: 0,
        },
        config: {
          defaultChatModel: 'gemini-3.1-flash-lite',
          defaultImageModel: 'gemini-2.5-flash-image',
          highQualityImageModel: 'gemini-nano-banana-2.1',
          imageRateLimitMax: 10,
          imageRateLimitWindowMinutes: 1440,
          maintenanceMode: false,
          allowLocalFallback: true,
          ollamaHost: 'http://localhost:11434',
        },
        logs: [],
      },
    };
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
    const res = await fetchWithTimeout(`/api/sync/live${query ? `?${query}` : ''}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as LiveSyncSnapshot;
  } catch {
    return null;
  }
}

