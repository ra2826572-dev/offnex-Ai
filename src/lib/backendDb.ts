import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AdminActivityLog,
  AdminRuntimeConfig,
  AppSettings,
  Conversation,
  GeneratedImageItem,
  GeneratedImageRecord,
  Message,
  StoredDocument,
  SupportTicket,
  UserProfile,
  UserRole,
} from '@/types';
import { getConfiguredImageModel } from './imageProvider';

const DATA_ROOT = path.resolve(process.cwd(), '.offnex-data');
const IMAGE_FILES_DIR = path.resolve(DATA_ROOT, 'image-files');

const FILES = {
  users: path.join(DATA_ROOT, 'users.json'),
  conversations: path.join(DATA_ROOT, 'conversations.json'),
  messages: path.join(DATA_ROOT, 'messages.json'),
  images: path.join(DATA_ROOT, 'images.json'),
  documents: path.join(DATA_ROOT, 'documents.json'),
  tickets: path.join(DATA_ROOT, 'tickets.json'),
  logs: path.join(DATA_ROOT, 'logs.json'),
  config: path.join(DATA_ROOT, 'config.json'),
  settings: path.join(DATA_ROOT, 'settings.json'),
  quotas: path.join(DATA_ROOT, 'quotas.json'),
  adminAuth: path.join(DATA_ROOT, 'admin-auth.json'),
  syncMeta: path.join(DATA_ROOT, 'sync-meta.json'),
} as const;

const MAX_LOGS = 400;
const LEGACY_PASSWORD_HASH =
  'b31a1d098825045aefb03dea941499ff98c4648566ac72b07dd3471c9de80732';
const LEGACY_ADMIN_PASSWORD_HASH =
  'cdbd26c0c05e86b7b8dceeecad9c44cfc11d4eba2f6eb7d40c19d227c44bdacd';

export interface StoredUserRecord extends UserProfile {
  passwordHash?: string;
}

export interface StoredDocumentSummary {
  id: string;
  userId?: string;
  userEmail?: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  pageCount: number;
  summary?: string;
}

interface BackendDbState {
  initialized: boolean;
  users: StoredUserRecord[];
  conversations: Conversation[];
  messages: Message[];
  images: GeneratedImageRecord[];
  documents: StoredDocumentSummary[];
  tickets: SupportTicket[];
  logs: AdminActivityLog[];
  config: AdminRuntimeConfig;
  settings: AppSettings;
  quotas: Record<string, number[]>;
}

interface SyncMeta {
  revision: number;
  updatedAt: string;
  deletedUserIds: string[];
  deletedConversationIds: string[];
  deletedImageIds: string[];
}

const globalForBackendDb = globalThis as typeof globalThis & {
  __offnexBackendDb?: BackendDbState;
  __offnexLoadedRevision?: number;
  __offnexAppVersionCache?: { value: string; checkedAt: number };
  __offnexServerStartedAt?: number;
};

function ensureDirs(): void {
  if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
  }
  if (!fs.existsSync(IMAGE_FILES_DIR)) {
    fs.mkdirSync(IMAGE_FILES_DIR, { recursive: true });
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  ensureDirs();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readSyncMeta(): SyncMeta {
  const raw = readJsonSafe<Partial<SyncMeta>>(FILES.syncMeta, {});
  return {
    revision: typeof raw.revision === 'number' && Number.isFinite(raw.revision) ? raw.revision : 1,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : new Date().toISOString(),
    deletedUserIds: Array.isArray(raw.deletedUserIds) ? raw.deletedUserIds : [],
    deletedConversationIds: Array.isArray(raw.deletedConversationIds) ? raw.deletedConversationIds : [],
    deletedImageIds: Array.isArray(raw.deletedImageIds) ? raw.deletedImageIds : [],
  };
}

function bumpSyncMeta(mutator?: (meta: SyncMeta) => void): SyncMeta {
  const current = readSyncMeta();
  current.revision = (current.revision || 0) + 1;
  current.updatedAt = new Date().toISOString();
  if (mutator) mutator(current);
  current.deletedUserIds = current.deletedUserIds.slice(-200);
  current.deletedConversationIds = current.deletedConversationIds.slice(-300);
  current.deletedImageIds = current.deletedImageIds.slice(-300);
  writeJsonAtomic(FILES.syncMeta, current);
  globalForBackendDb.__offnexLoadedRevision = current.revision;
  return current;
}

export function hashPasswordServer(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function legacySha256(password: string): string {
  if (password === 'password123') return LEGACY_PASSWORD_HASH;
  return crypto
    .createHash('sha256')
    .update(password + '_offlinegpt_salt_v1')
    .digest('hex');
}

export function verifyPasswordServer(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    try {
      const derived = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(expectedHex, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  const candidate = legacySha256(password);
  try {
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return candidate === storedHash;
  }
}

export function sanitizeUser(user: StoredUserRecord): UserProfile {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function getDefaultConfig(): AdminRuntimeConfig {
  return {
    defaultChatModel: process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.1-flash-lite',
    defaultImageModel: getConfiguredImageModel('standard'),
    highQualityImageModel: getConfiguredImageModel('high'),
    imageRateLimitMax: 10,
    imageRateLimitWindowMinutes: 1440,
    maintenanceMode: false,
    allowLocalFallback: true,
    ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
  };
}

function getDefaultSettings(): AppSettings {
  return {
    language: 'ur',
    theme: 'dark',
    defaultModel: 'gemini-3.1-flash-lite',
    ollamaHost: 'http://localhost:11434',
    temperature: 0.7,
    contextWindow: 4096,
    speechSpeed: 1.0,
    ttsVoice: 'default',
    offlineStrict: false,
    autoSaveHistory: true,
    enableSoundEffects: true,
  };
}

function getDefaultAdminPasscode(): string {
  return process.env.ADMIN_PASSWORD?.trim() || '59115911';
}

function getDefaultSeedUsers(): StoredUserRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'user-rizwan-ahmad',
      firstName: 'Rizwan',
      lastName: 'Ahmad',
      email: 'rizwan@gmail.com',
      role: 'user',
      passwordHash: LEGACY_PASSWORD_HASH,
      createdAt: '2026-11-10T12:00:00Z',
      lastLoginAt: now,
    },
    {
      id: 'user-ra2826572',
      firstName: 'Rizwan',
      lastName: 'Ahmad',
      email: 'ra2826572@gmail.com',
      role: 'business_owner',
      passwordHash: hashPasswordServer(getDefaultAdminPasscode()),
      createdAt: '2026-11-10T12:00:00Z',
      lastLoginAt: now,
    },
  ];
}

function getState(): BackendDbState {
  const diskMeta = readSyncMeta();
  if (
    globalForBackendDb.__offnexBackendDb?.initialized &&
    globalForBackendDb.__offnexLoadedRevision === diskMeta.revision
  ) {
    return globalForBackendDb.__offnexBackendDb;
  }

  ensureDirs();

  let users = readJsonSafe<StoredUserRecord[]>(FILES.users, []);
  if (!Array.isArray(users) || users.length === 0) {
    users = getDefaultSeedUsers();
    writeJsonAtomic(FILES.users, users);
  } else {
    let updatedUsers = false;
    for (const seed of getDefaultSeedUsers()) {
      const idx = users.findIndex((u) => u.email.toLowerCase() === seed.email.toLowerCase());
      if (idx === -1) {
        users.push(seed);
        updatedUsers = true;
      } else if (
        seed.id === 'user-ra2826572' &&
        (!users[idx].passwordHash || users[idx].passwordHash === LEGACY_PASSWORD_HASH)
      ) {
        users[idx].passwordHash = hashPasswordServer(getDefaultAdminPasscode());
        updatedUsers = true;
      }
    }
    if (updatedUsers) writeJsonAtomic(FILES.users, users);
  }

  const conversations = readJsonSafe<Conversation[]>(FILES.conversations, []);
  const messages = readJsonSafe<Message[]>(FILES.messages, []);
  const images = readJsonSafe<GeneratedImageRecord[]>(FILES.images, []);
  const documents = readJsonSafe<StoredDocumentSummary[]>(FILES.documents, []);
  const tickets = readJsonSafe<SupportTicket[]>(FILES.tickets, []);

  let logs = readJsonSafe<AdminActivityLog[]>(FILES.logs, []);
  if (!Array.isArray(logs) || logs.length === 0) {
    logs = [
      {
        id: `srv-boot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'system',
        message: 'Offnex AI persistent backend storage initialized',
        actor: 'system',
        source: 'server',
      },
    ];
    writeJsonAtomic(FILES.logs, logs);
  }

  const config = {
    ...getDefaultConfig(),
    ...readJsonSafe<Partial<AdminRuntimeConfig>>(FILES.config, {}),
  };
  if (!fs.existsSync(FILES.config)) {
    writeJsonAtomic(FILES.config, config);
  }

  const settings = {
    ...getDefaultSettings(),
    ...readJsonSafe<Partial<AppSettings>>(FILES.settings, {}),
  };
  if (!fs.existsSync(FILES.settings)) {
    writeJsonAtomic(FILES.settings, settings);
  }

  const quotas = readJsonSafe<Record<string, number[]>>(FILES.quotas, {});

  globalForBackendDb.__offnexBackendDb = {
    initialized: true,
    users,
    conversations: Array.isArray(conversations) ? conversations : [],
    messages: Array.isArray(messages) ? messages : [],
    images: Array.isArray(images) ? images : [],
    documents: Array.isArray(documents) ? documents : [],
    tickets: Array.isArray(tickets) ? tickets : [],
    logs,
    config,
    settings,
    quotas: quotas && typeof quotas === 'object' ? quotas : {},
  };

  if (!fs.existsSync(FILES.syncMeta)) {
    writeJsonAtomic(FILES.syncMeta, diskMeta);
  }
  globalForBackendDb.__offnexLoadedRevision = diskMeta.revision;

  return globalForBackendDb.__offnexBackendDb;
}

// ==================== IMAGE FILE PERSISTENCE ====================

export function resolveSafeBackendImagePath(filename: string): string | null {
  if (!/^[a-zA-Z0-9_-]{4,120}\.(png|jpg|jpeg|webp)$/.test(filename)) {
    return null;
  }
  const resolved = path.resolve(IMAGE_FILES_DIR, filename);
  if (!resolved.startsWith(IMAGE_FILES_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function persistImageDataUrl(dataUrl: string, prefix: string): string {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (dataUrl.startsWith('/api/backend/images/file/')) return dataUrl;

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return dataUrl;
  }

  ensureDirs();
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'img';
  const fileName = `${safePrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const fullPath = resolveSafeBackendImagePath(fileName);
  if (!fullPath) return dataUrl;

  const buf = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (buf.length === 0) return dataUrl;

  fs.writeFileSync(fullPath, buf);
  return `/api/backend/images/file/${fileName}`;
}

function deleteDiskImageIfUnused(url: string, state: BackendDbState): void {
  const prefix = '/api/backend/images/file/';
  if (!url.startsWith(prefix)) return;
  const filename = url.slice(prefix.length);
  const stillReferencedInImages = state.images.some((rec) =>
    rec.images.some((item) => item.dataUrl === url)
  );
  const stillReferencedInMsgs = state.messages.some((msg) =>
    msg.imageGeneration?.images?.some((item) => item.dataUrl === url)
  );
  if (stillReferencedInImages || stillReferencedInMsgs) return;

  const fullPath = resolveSafeBackendImagePath(filename);
  if (fullPath && fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ==================== USERS ====================

export function listBackendUsers(): UserProfile[] {
  return getState().users.map(sanitizeUser);
}

export function findBackendUserByEmail(email: string): StoredUserRecord | undefined {
  const clean = email.trim().toLowerCase();
  return getState().users.find((u) => u.email.toLowerCase() === clean);
}

export function findBackendUserById(id: string): StoredUserRecord | undefined {
  return getState().users.find((u) => u.id === id);
}

export function upsertUserAuthSync(payload: {
  id?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: UserRole;
  password?: string;
  avatarUrl?: string;
  mode?: 'login' | 'register' | 'sync';
}): { ok: boolean; user?: UserProfile; error?: string } {
  const state = getState();
  const cleanEmail = payload.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Valid email address is required.' };
  }

  const now = new Date().toISOString();
  const existingIdx = state.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);

  if (payload.mode === 'register' && existingIdx !== -1) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  if (existingIdx !== -1) {
    const existing = state.users[existingIdx];
    if (payload.mode === 'login' && payload.password) {
      const validServer = verifyPasswordServer(payload.password, existing.passwordHash);
      const validAdminSeed =
        existing.id === 'user-ra2826572' &&
        LEGACY_ADMIN_PASSWORD_HASH ===
          crypto
            .createHash('sha256')
            .update(payload.password + '_offlinegpt_salt_v1')
            .digest('hex') &&
        existing.passwordHash === LEGACY_ADMIN_PASSWORD_HASH;
      if (existing.passwordHash && !validServer && !validAdminSeed) {
        return { ok: false, error: 'Incorrect password.' };
      }
    }

    const updated: StoredUserRecord = {
      ...existing,
      firstName: payload.firstName?.trim() || existing.firstName,
      lastName:
        payload.lastName !== undefined ? payload.lastName.trim() : existing.lastName,
      role: payload.role || existing.role,
      avatarUrl: payload.avatarUrl || existing.avatarUrl,
      lastLoginAt: now,
      passwordHash:
        payload.password && (!existing.passwordHash || payload.mode === 'register')
          ? hashPasswordServer(payload.password)
          : existing.passwordHash,
    };
    state.users[existingIdx] = updated;
    writeJsonAtomic(FILES.users, state.users);
    bumpSyncMeta((meta) => {
      meta.deletedUserIds = meta.deletedUserIds.filter((uid) => uid !== updated.id);
    });
    if (payload.mode === 'login') {
      appendBackendLog('info', 'users', `User signed in: ${updated.email}`, updated.email, 'server');
    }
    return { ok: true, user: sanitizeUser(updated) };
  }

  const isRizwan = cleanEmail.includes('rizwan') || cleanEmail.includes('ra2826572');
  const prefix = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
  const words = prefix.split(' ').filter(Boolean);
  const fName =
    payload.firstName?.trim() ||
    (isRizwan
      ? 'Rizwan'
      : words[0]
      ? words[0].charAt(0).toUpperCase() + words[0].slice(1)
      : 'User');
  const lName =
    payload.lastName?.trim() ||
    (isRizwan
      ? 'Ahmad'
      : words[1]
      ? words[1].charAt(0).toUpperCase() + words[1].slice(1)
      : '');

  const created: StoredUserRecord = {
    id: payload.id?.trim() || `user-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    firstName: fName,
    lastName: lName,
    email: cleanEmail,
    role: payload.role || (isRizwan ? 'business_owner' : 'user'),
    avatarUrl: payload.avatarUrl,
    passwordHash: hashPasswordServer(payload.password || 'password123'),
    createdAt: now,
    lastLoginAt: now,
  };
  state.users.push(created);
  writeJsonAtomic(FILES.users, state.users);
  bumpSyncMeta((meta) => {
    meta.deletedUserIds = meta.deletedUserIds.filter((uid) => uid !== created.id);
  });
  appendBackendLog(
    'info',
    'users',
    `New user registered: ${created.firstName} ${created.lastName} (${created.email})`,
    created.email,
    'server'
  );
  return { ok: true, user: sanitizeUser(created) };
}

export function resetBackendUserPassword(
  email: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const state = getState();
  const cleanEmail = email.trim().toLowerCase();
  const idx = state.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx === -1) {
    return { ok: false, error: 'No user account found with this email.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }
  state.users[idx].passwordHash = hashPasswordServer(newPassword);
  writeJsonAtomic(FILES.users, state.users);
  appendBackendLog('info', 'users', `Password reset for ${cleanEmail}`, cleanEmail, 'server');
  return { ok: true };
}

export function createUserByAdminBackend(payload: {
  firstName: string;
  lastName?: string;
  email: string;
  role?: UserRole;
  password?: string;
}): { ok: boolean; user?: UserProfile; error?: string } {
  const state = getState();
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanFirst = payload.firstName.trim();
  if (!cleanFirst) return { ok: false, error: 'First name is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Valid email address is required.' };
  }
  if (state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return { ok: false, error: 'A user with this email already exists.' };
  }

  const now = new Date().toISOString();
  const newUser: StoredUserRecord = {
    id: `user-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    firstName: cleanFirst,
    lastName: payload.lastName?.trim() || 'Member',
    email: cleanEmail,
    role: payload.role === 'business_owner' ? 'business_owner' : 'user',
    passwordHash: hashPasswordServer(
      payload.password && payload.password.length >= 6 ? payload.password : 'password123'
    ),
    createdAt: now,
  };
  state.users.push(newUser);
  writeJsonAtomic(FILES.users, state.users);
  bumpSyncMeta();
  appendBackendLog('info', 'users', `Admin created user ${newUser.email}`, 'admin', 'server');
  return { ok: true, user: sanitizeUser(newUser) };
}

export function updateUserByAdminBackend(
  id: string,
  patch: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'role' | 'email'>>
): UserProfile | null {
  const state = getState();
  const idx = state.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  const target = state.users[idx];
  const updated: StoredUserRecord = {
    ...target,
    firstName: patch.firstName !== undefined ? patch.firstName.trim() : target.firstName,
    lastName: patch.lastName !== undefined ? patch.lastName.trim() : target.lastName,
    email: patch.email ? patch.email.trim().toLowerCase() : target.email,
    role:
      patch.role === 'business_owner' || patch.role === 'user' ? patch.role : target.role,
  };
  state.users[idx] = updated;
  writeJsonAtomic(FILES.users, state.users);
  bumpSyncMeta();
  appendBackendLog('info', 'users', `Updated user ${updated.email} (role: ${updated.role})`, 'admin', 'server');
  return sanitizeUser(updated);
}

export function deleteUserByAdminBackend(id: string): boolean {
  const state = getState();
  const existing = state.users.find((u) => u.id === id);
  if (!existing) return false;
  state.users = state.users.filter((u) => u.id !== id);
  writeJsonAtomic(FILES.users, state.users);
  bumpSyncMeta((meta) => {
    if (!meta.deletedUserIds.includes(id)) meta.deletedUserIds.push(id);
  });
  appendBackendLog('warn', 'users', `Deleted user account ${existing.email}`, 'admin', 'server');
  return true;
}

// ==================== CONVERSATIONS & MESSAGES ====================

export function listBackendConversations(userId?: string): Conversation[] {
  const state = getState();
  const list = userId
    ? state.conversations.filter((c) => c.userId === userId)
    : state.conversations;
  return [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function listBackendMessages(options?: {
  conversationId?: string;
  userId?: string;
}): Message[] {
  const state = getState();
  if (options?.conversationId) {
    return state.messages.filter((m) => m.conversationId === options.conversationId);
  }
  if (options?.userId) {
    const convIds = new Set(
      state.conversations.filter((c) => c.userId === options.userId).map((c) => c.id)
    );
    return state.messages.filter(
      (m) => m.userId === options.userId || convIds.has(m.conversationId)
    );
  }
  return [...state.messages];
}

export function upsertBackendConversation(conv: Conversation): Conversation {
  const state = getState();
  const idx = state.conversations.findIndex((c) => c.id === conv.id);
  const normalized: Conversation = {
    ...conv,
    updatedAt: conv.updatedAt || new Date().toISOString(),
    createdAt: conv.createdAt || new Date().toISOString(),
  };
  if (idx !== -1) {
    state.conversations[idx] = { ...state.conversations[idx], ...normalized };
  } else {
    state.conversations.unshift(normalized);
    appendBackendLog(
      'info',
      'chat',
      `Created chat "${normalized.title}"`,
      normalized.userEmail || normalized.userId || 'user',
      'server'
    );
  }
  writeJsonAtomic(FILES.conversations, state.conversations);
  bumpSyncMeta((meta) => {
    meta.deletedConversationIds = meta.deletedConversationIds.filter((cid) => cid !== normalized.id);
  });
  return normalized;
}

export function upsertBackendMessages(items: Message[]): Message[] {
  const state = getState();
  const saved: Message[] = [];

  for (const rawMsg of items) {
    if (!rawMsg?.id || !rawMsg?.conversationId) continue;
    let nextMsg = { ...rawMsg };

    if (nextMsg.imageGeneration) {
      const persistedImgs: GeneratedImageItem[] = (nextMsg.imageGeneration.images || []).map(
        (img, i) => ({
          ...img,
          dataUrl: persistImageDataUrl(img.dataUrl, `chat_${nextMsg.id}_${i}`),
        })
      );
      const refUrl = nextMsg.imageGeneration.referencePreviewUrl
        ? persistImageDataUrl(nextMsg.imageGeneration.referencePreviewUrl, `ref_${nextMsg.id}`)
        : undefined;
      nextMsg = {
        ...nextMsg,
        imageGeneration: {
          ...nextMsg.imageGeneration,
          images: persistedImgs,
          ...(refUrl ? { referencePreviewUrl: refUrl } : {}),
        },
      };
    }

    const idx = state.messages.findIndex((m) => m.id === nextMsg.id);
    if (idx !== -1) {
      state.messages[idx] = nextMsg;
    } else {
      state.messages.push(nextMsg);
    }
    saved.push(nextMsg);

    const convIdx = state.conversations.findIndex((c) => c.id === nextMsg.conversationId);
    if (convIdx !== -1) {
      const convMsgsCount = state.messages.filter(
        (m) => m.conversationId === nextMsg.conversationId
      ).length;
      state.conversations[convIdx] = {
        ...state.conversations[convIdx],
        messagesCount: Math.max(state.conversations[convIdx].messagesCount || 0, convMsgsCount),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  writeJsonAtomic(FILES.messages, state.messages);
  writeJsonAtomic(FILES.conversations, state.conversations);
  if (saved.length > 0) {
    bumpSyncMeta();
  }
  return saved;
}

export function deleteBackendConversation(id: string): boolean {
  const state = getState();
  const exists = state.conversations.some((c) => c.id === id);
  const removedMsgs = state.messages.filter((m) => m.conversationId === id);
  state.conversations = state.conversations.filter((c) => c.id !== id);
  state.messages = state.messages.filter((m) => m.conversationId !== id);

  for (const msg of removedMsgs) {
    for (const img of msg.imageGeneration?.images || []) {
      deleteDiskImageIfUnused(img.dataUrl, state);
    }
  }

  writeJsonAtomic(FILES.conversations, state.conversations);
  writeJsonAtomic(FILES.messages, state.messages);
  if (exists) {
    bumpSyncMeta((meta) => {
      if (!meta.deletedConversationIds.includes(id)) meta.deletedConversationIds.push(id);
    });
    appendBackendLog('warn', 'chat', `Deleted conversation ${id}`, 'admin', 'server');
  }
  return exists;
}

// ==================== IMAGES ====================

export function listBackendImages(userId?: string): GeneratedImageRecord[] {
  const state = getState();
  const list = userId
    ? state.images.filter((img) => img.userId === userId)
    : state.images;
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function saveBackendImageRecord(record: GeneratedImageRecord): GeneratedImageRecord {
  const state = getState();
  const persistedImages: GeneratedImageItem[] = (record.images || []).map((item, idx) => ({
    id: item.id || `img-${Date.now()}-${idx}`,
    mimeType: item.mimeType || 'image/png',
    dataUrl: persistImageDataUrl(item.dataUrl, `gen_${record.id || Date.now()}_${idx}`),
  }));

  const normalized: GeneratedImageRecord = {
    ...record,
    images: persistedImages,
    count: persistedImages.length || record.count || 1,
    createdAt: record.createdAt || new Date().toISOString(),
  };

  const idx = state.images.findIndex((r) => r.id === normalized.id);
  if (idx !== -1) {
    state.images[idx] = normalized;
  } else {
    state.images.unshift(normalized);
  }
  writeJsonAtomic(FILES.images, state.images);
  bumpSyncMeta((meta) => {
    meta.deletedImageIds = meta.deletedImageIds.filter((iid) => iid !== normalized.id);
  });
  return normalized;
}

export function deleteBackendImageRecord(id: string, userId?: string): boolean {
  const state = getState();
  const target = state.images.find((r) => r.id === id);
  if (!target) return false;
  if (userId && target.userId !== userId) return false;

  state.images = state.images.filter((r) => r.id !== id);
  for (const img of target.images || []) {
    deleteDiskImageIfUnused(img.dataUrl, state);
  }
  writeJsonAtomic(FILES.images, state.images);
  bumpSyncMeta((meta) => {
    if (!meta.deletedImageIds.includes(id)) meta.deletedImageIds.push(id);
  });
  appendBackendLog('warn', 'image', `Removed generated image record ${id}`, userId || 'admin', 'server');
  return true;
}

// ==================== DOCUMENTS ====================

export function listBackendDocuments(userId?: string): StoredDocumentSummary[] {
  const state = getState();
  const list = userId
    ? state.documents.filter((d) => d.userId === userId)
    : state.documents;
  return [...list].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function saveBackendDocument(doc: StoredDocument): StoredDocumentSummary {
  const state = getState();
  const summary: StoredDocumentSummary = {
    id: doc.id,
    userId: doc.userId,
    userEmail: doc.userEmail,
    name: doc.name,
    size: doc.size,
    type: doc.type,
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
    pageCount: doc.pageCount || 1,
    summary: doc.summary || doc.content?.slice(0, 260),
  };
  const idx = state.documents.findIndex((d) => d.id === summary.id);
  if (idx !== -1) {
    state.documents[idx] = summary;
  } else {
    state.documents.unshift(summary);
    appendBackendLog(
      'info',
      'system',
      `Uploaded knowledge document "${summary.name}"`,
      summary.userEmail || summary.userId || 'user',
      'server'
    );
  }
  writeJsonAtomic(FILES.documents, state.documents);
  bumpSyncMeta();
  return summary;
}

export function deleteBackendDocument(id: string): boolean {
  const state = getState();
  const lenBefore = state.documents.length;
  state.documents = state.documents.filter((d) => d.id !== id);
  if (state.documents.length !== lenBefore) {
    writeJsonAtomic(FILES.documents, state.documents);
    bumpSyncMeta();
    return true;
  }
  return false;
}

// ==================== SUPPORT TICKETS ====================

export function listBackendTickets(userId?: string, userEmail?: string): SupportTicket[] {
  const state = getState();
  let list = state.tickets;
  if (userId || userEmail) {
    const cleanEmail = userEmail?.trim().toLowerCase();
    list = list.filter(
      (t) =>
        (userId && t.userId === userId) ||
        (cleanEmail && t.userEmail.toLowerCase() === cleanEmail)
    );
  }
  return [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function saveBackendTicket(
  ticket: Partial<SupportTicket> & { subject?: string; id?: string }
): SupportTicket {
  const state = getState();
  const now = new Date().toISOString();
  const existingIdx = ticket.id ? state.tickets.findIndex((t) => t.id === ticket.id) : -1;
  const existing = existingIdx !== -1 ? state.tickets[existingIdx] : undefined;

  const normalized: SupportTicket = {
    id: ticket.id || `tkt-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    userId: ticket.userId ?? existing?.userId,
    userEmail: ticket.userEmail ?? existing?.userEmail ?? 'user@offnex.ai',
    userName: ticket.userName ?? existing?.userName ?? 'User',
    subject: ticket.subject?.trim() || existing?.subject || 'Support Request',
    message: ticket.message ?? existing?.message ?? '',
    status: ticket.status ?? existing?.status ?? 'open',
    priority: ticket.priority ?? existing?.priority ?? 'medium',
    adminReply: ticket.adminReply !== undefined ? ticket.adminReply : existing?.adminReply,
    createdAt: ticket.createdAt || existing?.createdAt || now,
    updatedAt: now,
  };

  if (existingIdx !== -1) {
    state.tickets[existingIdx] = normalized;
  } else {
    state.tickets.unshift(normalized);
  }
  writeJsonAtomic(FILES.tickets, state.tickets);
  bumpSyncMeta();
  appendBackendLog(
    'info',
    'tickets',
    `Saved support ticket "${normalized.subject}" (${normalized.status})`,
    normalized.userEmail || 'user',
    'server'
  );
  return normalized;
}

export function deleteBackendTicket(id: string): boolean {
  const state = getState();
  const lenBefore = state.tickets.length;
  state.tickets = state.tickets.filter((t) => t.id !== id);
  if (state.tickets.length !== lenBefore) {
    writeJsonAtomic(FILES.tickets, state.tickets);
    bumpSyncMeta();
    return true;
  }
  return false;
}

// ==================== LOGS ====================

export function getBackendLogs(): AdminActivityLog[] {
  return getState().logs;
}

export function appendBackendLog(
  level: 'info' | 'warn' | 'error',
  category: string,
  message: string,
  actor?: string,
  source: 'server' | 'client' = 'server'
): AdminActivityLog {
  const state = getState();
  const entry: AdminActivityLog = {
    id: `${source === 'server' ? 'srv' : 'cli'}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    actor,
    source,
  };
  state.logs.unshift(entry);
  if (state.logs.length > MAX_LOGS) {
    state.logs.length = MAX_LOGS;
  }
  writeJsonAtomic(FILES.logs, state.logs);
  return entry;
}

export function clearBackendLogs(): AdminActivityLog[] {
  const state = getState();
  state.logs = [];
  appendBackendLog('info', 'admin', 'Activity logs cleared by admin', 'admin', 'server');
  return state.logs;
}

// ==================== RUNTIME CONFIG & SYSTEM SETTINGS ====================

export function getBackendRuntimeConfig(): AdminRuntimeConfig {
  return getState().config;
}

export function updateBackendRuntimeConfig(
  body: Partial<AdminRuntimeConfig>
): AdminRuntimeConfig {
  const state = getState();
  const cfg = state.config;
  if (typeof body.defaultChatModel === 'string' && body.defaultChatModel.trim()) {
    cfg.defaultChatModel = body.defaultChatModel.trim();
  }
  if (typeof body.defaultImageModel === 'string' && body.defaultImageModel.trim()) {
    cfg.defaultImageModel = body.defaultImageModel.trim();
  }
  if (typeof body.highQualityImageModel === 'string' && body.highQualityImageModel.trim()) {
    cfg.highQualityImageModel = body.highQualityImageModel.trim();
  }
  if (typeof body.imageRateLimitMax === 'number' && Number.isFinite(body.imageRateLimitMax)) {
    cfg.imageRateLimitMax = Math.min(200, Math.max(1, Math.floor(body.imageRateLimitMax)));
  }
  if (
    typeof body.imageRateLimitWindowMinutes === 'number' &&
    Number.isFinite(body.imageRateLimitWindowMinutes)
  ) {
    cfg.imageRateLimitWindowMinutes = Math.min(
      1440,
      Math.max(1, Math.floor(body.imageRateLimitWindowMinutes))
    );
  }
  if (typeof body.maintenanceMode === 'boolean') {
    cfg.maintenanceMode = body.maintenanceMode;
  }
  if (typeof body.allowLocalFallback === 'boolean') {
    cfg.allowLocalFallback = body.allowLocalFallback;
  }
  if (typeof body.ollamaHost === 'string' && body.ollamaHost.trim()) {
    cfg.ollamaHost = body.ollamaHost.trim().replace(/\/+$/, '');
  }
  writeJsonAtomic(FILES.config, cfg);
  bumpSyncMeta();
  return cfg;
}

export function getBackendSystemSettings(): AppSettings {
  return getState().settings;
}

export function updateBackendSystemSettings(
  patch: Partial<AppSettings>,
  actor: string = 'admin'
): AppSettings {
  const state = getState();
  state.settings = {
    ...state.settings,
    ...patch,
  };
  writeJsonAtomic(FILES.settings, state.settings);
  bumpSyncMeta();
  appendBackendLog('info', 'settings', 'Updated persistent system settings', actor, 'server');
  return state.settings;
}

// ==================== IMAGE QUOTAS ====================

export function getBackendRemainingImageQuota(key: string): {
  remaining: number;
  limit: number;
  resetMs: number;
} {
  const state = getState();
  const now = Date.now();
  const maxAllowed = state.config.imageRateLimitMax;
  const windowMs = state.config.imageRateLimitWindowMinutes * 60 * 1000;
  const rawList = state.quotas[key] || [];
  const timestamps = rawList.filter((ts) => now - ts < windowMs);
  if (timestamps.length !== rawList.length) {
    state.quotas[key] = timestamps;
    writeJsonAtomic(FILES.quotas, state.quotas);
  }
  const oldest = timestamps[0] ?? now;
  return {
    remaining: Math.max(0, maxAllowed - timestamps.length),
    limit: maxAllowed,
    resetMs: timestamps.length > 0 ? Math.max(0, windowMs - (now - oldest)) : 0,
  };
}

export function consumeBackendImageQuota(
  key: string,
  count: number = 1
): {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
} {
  const state = getState();
  const status = getBackendRemainingImageQuota(key);
  const units = Math.max(1, Math.floor(count));
  if (status.remaining < units) {
    return { allowed: false, ...status };
  }
  const timestamps = state.quotas[key] || [];
  const now = Date.now();
  for (let i = 0; i < units; i++) {
    timestamps.push(now);
  }
  state.quotas[key] = timestamps;
  writeJsonAtomic(FILES.quotas, state.quotas);
  return {
    allowed: true,
    remaining: Math.max(0, status.remaining - units),
    limit: status.limit,
    resetMs: status.resetMs,
  };
}

// ==================== FULL BACKUP SNAPSHOT ====================

export function exportBackendFullSnapshot() {
  const state = getState();
  return {
    app: 'Offnex AI Backend',
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    data: {
      users: listBackendUsers(),
      conversations: state.conversations,
      messages: state.messages,
      images: state.images,
      documents: state.documents,
      tickets: state.tickets,
      logs: state.logs,
      config: state.config,
      settings: state.settings,
    },
  };
}

// ==================== ADMIN PANEL ACCESS AUTH ====================

interface AdminAuthRecord {
  passcodeHash: string;
  sessionSecret: string;
  updatedAt: string;
}

function getAdminAuthRecord(): AdminAuthRecord {
  ensureDirs();
  const existing = readJsonSafe<Partial<AdminAuthRecord>>(FILES.adminAuth, {});
  if (existing.passcodeHash && existing.sessionSecret) {
    return existing as AdminAuthRecord;
  }
  const created: AdminAuthRecord = {
    passcodeHash: existing.passcodeHash || hashPasswordServer(getDefaultAdminPasscode()),
    sessionSecret: existing.sessionSecret || crypto.randomBytes(32).toString('hex'),
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(FILES.adminAuth, created);
  return created;
}

export function verifyAdminPasscode(passcode: string): boolean {
  if (!passcode || !passcode.trim()) return false;
  const authRecord = getAdminAuthRecord();
  return verifyPasswordServer(passcode.trim(), authRecord.passcodeHash);
}

export function updateAdminPasscode(
  currentPasscode: string,
  newPasscode: string
): { ok: boolean; error?: string } {
  if (!verifyAdminPasscode(currentPasscode)) {
    return { ok: false, error: 'Current admin password is incorrect.' };
  }
  const cleanNew = newPasscode.trim();
  if (cleanNew.length < 4) {
    return { ok: false, error: 'New admin password must be at least 4 characters.' };
  }
  const existing = getAdminAuthRecord();
  const updated: AdminAuthRecord = {
    ...existing,
    passcodeHash: hashPasswordServer(cleanNew),
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(FILES.adminAuth, updated);

  // Also sync seeded business_owner user password if present
  const state = getState();
  const adminIdx = state.users.findIndex((u) => u.id === 'user-ra2826572');
  if (adminIdx !== -1) {
    state.users[adminIdx].passwordHash = updated.passcodeHash;
    writeJsonAtomic(FILES.users, state.users);
  }
  appendBackendLog('info', 'admin', 'Admin access password updated', 'admin', 'server');
  return { ok: true };
}

export function createAdminSessionToken(): string {
  const { sessionSecret } = getAdminAuthRecord();
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload = `admin.${exp}.${crypto.randomBytes(8).toString('hex')}`;
  const sig = crypto.createHmac('sha256', sessionSecret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [role, expStr, nonce, sig] = parts;
  if (role !== 'admin') return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const { sessionSecret } = getAdminAuthRecord();
  const expectedSig = crypto
    .createHmac('sha256', sessionSecret)
    .update(`${role}.${expStr}.${nonce}`)
    .digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ==================== LIVE APP VERSION & DATA SYNC ====================

export function getBackendAppVersion(): string {
  const now = Date.now();
  const cached = globalForBackendDb.__offnexAppVersionCache;
  if (cached && now - cached.checkedAt < 2500) {
    return cached.value;
  }

  if (!globalForBackendDb.__offnexServerStartedAt) {
    globalForBackendDb.__offnexServerStartedAt = now;
  }

  let buildId = '';
  const buildIdPath = path.resolve(process.cwd(), '.next', 'BUILD_ID');
  try {
    if (fs.existsSync(buildIdPath)) {
      buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
    }
  } catch {
    // Ignore read error
  }

  const watchFiles = [
    path.resolve(process.cwd(), 'public', 'sw.js'),
    path.resolve(process.cwd(), 'public', 'manifest.webmanifest'),
    path.resolve(process.cwd(), 'package.json'),
    path.resolve(process.cwd(), 'src', 'app', 'layout.tsx'),
    path.resolve(process.cwd(), 'src', 'app', 'page.tsx'),
    path.resolve(process.cwd(), 'src', 'app', 'admin', 'page.tsx'),
    path.resolve(process.cwd(), 'src', 'components', 'OfflineGptWorkspace.tsx'),
    path.resolve(process.cwd(), 'src', 'components', 'ChatView.tsx'),
    path.resolve(process.cwd(), 'src', 'components', 'ImagesView.tsx'),
    path.resolve(process.cwd(), 'src', 'components', 'SettingsView.tsx'),
    path.resolve(process.cwd(), 'src', 'components', 'admin', 'AdminPanel.tsx'),
  ];

  let maxMtime = 0;
  for (const filePath of watchFiles) {
    try {
      const st = fs.statSync(filePath);
      if (st.mtimeMs > maxMtime) maxMtime = Math.floor(st.mtimeMs);
    } catch {
      // Ignore missing optional path
    }
  }

  const version = buildId
    ? `build-${buildId}-${maxMtime}`
    : `srv-${globalForBackendDb.__offnexServerStartedAt}-${maxMtime}`;

  globalForBackendDb.__offnexAppVersionCache = {
    value: version,
    checkedAt: now,
  };
  return version;
}

export function getBackendLiveSyncSnapshot(options?: {
  userId?: string;
  email?: string;
}) {
  const state = getState();
  const meta = readSyncMeta();
  const appVersion = getBackendAppVersion();

  let matchedUser: UserProfile | null = null;
  let userDeleted = false;

  if (options?.userId) {
    const foundById = state.users.find((u) => u.id === options.userId);
    if (foundById) {
      matchedUser = sanitizeUser(foundById);
    } else if (meta.deletedUserIds.includes(options.userId)) {
      userDeleted = true;
    }
  }

  if (!matchedUser && !userDeleted && options?.email) {
    const cleanEmail = options.email.trim().toLowerCase();
    const foundByEmail = state.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (foundByEmail) {
      matchedUser = sanitizeUser(foundByEmail);
    }
  }

  const uid = matchedUser?.id || options?.userId;
  const uEmail = matchedUser?.email || options?.email;

  const userConvs = uid ? listBackendConversations(uid) : state.conversations;
  const userImgs = uid ? listBackendImages(uid) : state.images;
  const userTickets = uid || uEmail ? listBackendTickets(uid, uEmail) : state.tickets;
  const userDocs = uid ? listBackendDocuments(uid) : state.documents;

  return {
    ok: true,
    appVersion,
    dataRevision: `${meta.revision}:${meta.updatedAt}`,
    revisionNumber: meta.revision,
    updatedAt: meta.updatedAt,
    settings: state.settings,
    config: {
      defaultChatModel: state.config.defaultChatModel,
      defaultImageModel: state.config.defaultImageModel,
      highQualityImageModel: state.config.highQualityImageModel,
      imageRateLimitMax: state.config.imageRateLimitMax,
      imageRateLimitWindowMinutes: state.config.imageRateLimitWindowMinutes,
      maintenanceMode: state.config.maintenanceMode,
      allowLocalFallback: state.config.allowLocalFallback,
      ollamaHost: state.config.ollamaHost,
    },
    user: matchedUser,
    userDeleted,
    deletedConversationIds: meta.deletedConversationIds,
    deletedImageIds: meta.deletedImageIds,
    counts: {
      users: state.users.length,
      conversations: userConvs.length,
      messages: state.messages.length,
      images: userImgs.length,
      tickets: userTickets.length,
      documents: userDocs.length,
    },
  };
}

