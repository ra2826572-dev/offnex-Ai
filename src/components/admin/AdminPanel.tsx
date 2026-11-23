'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdminActivityLog,
  AdminOverviewResponse,
  AdminRuntimeConfig,
  AdminSection,
  AppSettings,
  Conversation,
  GeneratedImageRecord,
  Message,
  StoredDocument,
  SupportTicket,
  UserProfile,
  UserRole,
} from '../../types';
import { db } from '../../services/db';
import { authService } from '../../services/authService';
import {
  deleteConversationOnBackend,
  deleteImageRecordOnBackend,
  deleteTicketOnBackend,
  fetchAdminBootstrapFromBackend,
  fetchLiveSyncState,
  pushActivityLogToBackend,
  saveTicketToBackend,
  syncSettingsToBackend,
} from '../../services/backendSync';
import { AnalyticsRange, KpiSparkline, PlatformAnalyticsChart } from './AdminCharts';
import { AdminSubViews } from './AdminSubViews';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Cpu,
  KeyRound,
  Settings,
  BarChart3,
  FileText,
  LifeBuoy,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Search,
  Bell,
  Calendar,
  Zap,
  Rocket,
  FolderKanban,
  ArrowRight,
  Sparkles,
  UserPlus,
  ImagePlus,
  MessageCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const ADMIN_SNAPSHOT_CACHE_KEY = 'offnex_admin_cached_snapshot_v1';

type AdminSyncStatus = 'live' | 'cached' | 'offline';

interface CachedAdminSnapshot {
  users: UserProfile[];
  conversations: Conversation[];
  messages: Message[];
  images: GeneratedImageRecord[];
  documents: StoredDocument[];
  tickets: SupportTicket[];
  logs: AdminActivityLog[];
  settings?: AppSettings;
  savedAt: string;
}

function compactImageRecordForCache(rec: GeneratedImageRecord): GeneratedImageRecord {
  return {
    ...rec,
    videoUrl:
      rec.videoUrl && rec.videoUrl.startsWith('data:') && rec.videoUrl.length > 48_000
        ? undefined
        : rec.videoUrl,
    images: (rec.images || []).map((img) => ({
      ...img,
      dataUrl:
        img.dataUrl && img.dataUrl.startsWith('data:') && img.dataUrl.length > 65_000
          ? ''
          : img.dataUrl,
    })),
  };
}

function readCachedAdminSnapshot(): CachedAdminSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAdminSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedAdminSnapshot(snap: CachedAdminSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const compact: CachedAdminSnapshot = {
      ...snap,
      images: snap.images.slice(0, 120).map(compactImageRecordForCache),
      messages: snap.messages.slice(-300).map((m) => ({
        ...m,
        videoGeneration: m.videoGeneration
          ? {
              ...m.videoGeneration,
              videoUrl:
                m.videoGeneration.videoUrl?.startsWith('data:') &&
                m.videoGeneration.videoUrl.length > 48_000
                  ? ''
                  : m.videoGeneration.videoUrl,
            }
          : undefined,
      })),
    };
    localStorage.setItem(ADMIN_SNAPSHOT_CACHE_KEY, JSON.stringify(compact));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

interface AdminPanelProps {
  currentUser: UserProfile | null;
  onExitAdmin: () => void;
  onLogout: () => void;
  onAppDataMutated?: () => Promise<void> | void;
}

interface SidebarNavItem {
  id: AdminSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'chats', label: 'Chat Management', icon: MessageSquare },
  { id: 'images', label: 'Image Management', icon: ImageIcon },
  { id: 'models', label: 'AI Models', icon: Cpu },
  { id: 'api', label: 'API Configuration', icon: KeyRound },
  { id: 'settings', label: 'System Settings', icon: Settings },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'logs', label: 'Logs & Activity', icon: FileText },
  { id: 'tickets', label: 'Support Tickets', icon: LifeBuoy },
];

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getInitial(name?: string, fallback = 'A'): string {
  const clean = (name || '').trim();
  return clean ? clean.charAt(0).toUpperCase() : fallback;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onExitAdmin,
  onLogout,
  onAppDataMutated,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('7D');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Real platform state
  const [users, setUsers] = useState<UserProfile[]>(() => authService.getStoredUsers());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [images, setImages] = useState<GeneratedImageRecord[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [clientLogs, setClientLogs] = useState<AdminActivityLog[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
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
  });
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [syncStatus, setSyncStatus] = useState<AdminSyncStatus>('live');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastAdminRevisionRef = useRef<string | null>(null);
  const hasBackendSyncRef = useRef<boolean>(false);

  const loadAllAdminData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await authService.init();
      await db.init();

      const [
        bootstrap,
        localConvs,
        localMsgs,
        localImgs,
        localDocs,
        localSettings,
        localTickets,
        localLogs,
      ] = await Promise.all([
        fetchAdminBootstrapFromBackend(),
        db.getConversations(),
        db.getAllMessages(),
        db.getAllImageHistory(),
        db.getDocuments(),
        db.getSettings(),
        db.getSupportTickets(),
        db.getActivityLogs(),
      ]);

      const cachedSnap = readCachedAdminSnapshot();
      const hasBackend = Boolean(bootstrap);
      hasBackendSyncRef.current = hasBackend;
      setSyncStatus(
        hasBackend
          ? 'live'
          : typeof navigator !== 'undefined' && navigator.onLine
            ? cachedSnap
              ? 'cached'
              : 'offline'
            : cachedSnap
              ? 'cached'
              : 'offline'
      );

      // 1. Merge Users across backend, cached snapshot, local auth store, and inferred owners
      const storedLocalUsers = authService.getStoredUsers();
      const userMapById = new Map<string, UserProfile>();
      const userIdByEmail = new Map<string, string>();
      const addUser = (u: UserProfile) => {
        if (!u?.email) return;
        const emailLow = u.email.trim().toLowerCase();
        const existingId = userIdByEmail.get(emailLow);
        if (existingId && existingId !== u.id) {
          const prev = userMapById.get(existingId);
          if (prev) {
            userMapById.set(existingId, {
              ...prev,
              ...u,
              id: prev.id,
            });
            return;
          }
        }
        userIdByEmail.set(emailLow, u.id);
        const prev = userMapById.get(u.id);
        userMapById.set(u.id, prev ? { ...prev, ...u } : u);
      };

      for (const u of storedLocalUsers) addUser(u);
      if (cachedSnap?.users && !hasBackend) {
        for (const u of cachedSnap.users) addUser(u);
      }
      if (bootstrap?.users) {
        for (const u of bootstrap.users) addUser(u);
      }

      // 2. Merge Conversations
      const convMap = new Map<string, Conversation>();
      for (const c of localConvs) convMap.set(c.id, c);
      if (cachedSnap?.conversations && !hasBackend) {
        for (const c of cachedSnap.conversations) {
          const prev = convMap.get(c.id);
          if (!prev || new Date(c.updatedAt) >= new Date(prev.updatedAt)) {
            convMap.set(c.id, c);
          }
        }
      }
      if (bootstrap?.conversations) {
        for (const c of bootstrap.conversations) {
          const prev = convMap.get(c.id);
          if (!prev || new Date(c.updatedAt) >= new Date(prev.updatedAt)) {
            convMap.set(c.id, c);
          }
        }
      }

      // 3. Merge Messages
      const msgMap = new Map<string, Message>();
      for (const m of localMsgs) msgMap.set(m.id, m);
      if (cachedSnap?.messages && !hasBackend) {
        for (const m of cachedSnap.messages) {
          if (!msgMap.has(m.id)) msgMap.set(m.id, m);
        }
      }
      if (bootstrap?.messages) {
        for (const m of bootstrap.messages) {
          msgMap.set(m.id, m);
        }
      }

      // Infer any missing user accounts that have emails on chats/images/tickets
      const rawImagesPool: GeneratedImageRecord[] = [
        ...(bootstrap?.images || []),
        ...(!hasBackend && cachedSnap?.images ? cachedSnap.images : []),
        ...localImgs,
      ];
      for (const rec of rawImagesPool) {
        if (rec.userEmail) {
          const low = rec.userEmail.trim().toLowerCase();
          if (!userIdByEmail.has(low)) {
            const parts = (rec.userName || low.split('@')[0] || 'User').trim().split(/\s+/);
            addUser({
              id: rec.userId && rec.userId !== 'anonymous' ? rec.userId : `inferred-${low}`,
              firstName: parts[0] || 'User',
              lastName: parts.slice(1).join(' '),
              email: rec.userEmail.trim(),
              role: 'user',
              createdAt: rec.createdAt || new Date().toISOString(),
            });
          }
        }
      }
      for (const conv of convMap.values()) {
        if (conv.userEmail) {
          const low = conv.userEmail.trim().toLowerCase();
          if (!userIdByEmail.has(low)) {
            const parts = (conv.userName || low.split('@')[0] || 'User').trim().split(/\s+/);
            addUser({
              id: conv.userId && conv.userId !== 'anonymous' ? conv.userId : `inferred-${low}`,
              firstName: parts[0] || 'User',
              lastName: parts.slice(1).join(' '),
              email: conv.userEmail.trim(),
              role: 'user',
              createdAt: conv.createdAt || new Date().toISOString(),
            });
          }
        }
      }

      const mergedUsers = Array.from(userMapById.values());
      const userByIdLookup = new Map(mergedUsers.map((u) => [u.id, u]));
      const userByEmailLookup = new Map(mergedUsers.map((u) => [u.email.toLowerCase(), u]));

      // Enrich conversations with owner email/name if missing
      const mergedConversations = Array.from(convMap.values())
        .map((c) => {
          const u =
            (c.userId ? userByIdLookup.get(c.userId) : undefined) ||
            (c.userEmail ? userByEmailLookup.get(c.userEmail.toLowerCase()) : undefined);
          if (!u) return c;
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
          return {
            ...c,
            userId: c.userId || u.id,
            userEmail: c.userEmail || u.email,
            userName: c.userName || fullName || u.email,
          };
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const convByIdLookup = new Map(mergedConversations.map((c) => [c.id, c]));
      const mergedMessages = Array.from(msgMap.values());

      // 4. Merge Image Records across backend, cache, IndexedDB, AND chat message attachments
      const imgMap = new Map<string, GeneratedImageRecord>();
      const seenConvPromptKeys = new Set<string>();
      const upsertImage = (rec: GeneratedImageRecord, preferOverwrite: boolean) => {
        const matchedConv = rec.conversationId ? convByIdLookup.get(rec.conversationId) : undefined;
        const matchedUser =
          (rec.userId && rec.userId !== 'anonymous' ? userByIdLookup.get(rec.userId) : undefined) ||
          (rec.userEmail ? userByEmailLookup.get(rec.userEmail.toLowerCase()) : undefined) ||
          (matchedConv?.userId ? userByIdLookup.get(matchedConv.userId) : undefined) ||
          (matchedConv?.userEmail
            ? userByEmailLookup.get(matchedConv.userEmail.toLowerCase())
            : undefined);
        const ownerFullName = matchedUser
          ? [matchedUser.firstName, matchedUser.lastName].filter(Boolean).join(' ').trim()
          : '';
        const enriched: GeneratedImageRecord = {
          ...rec,
          userId:
            rec.userId && rec.userId !== 'anonymous'
              ? rec.userId
              : matchedUser?.id || matchedConv?.userId || rec.userId || 'anonymous',
          userEmail: rec.userEmail || matchedUser?.email || matchedConv?.userEmail,
          userName: rec.userName || ownerFullName || matchedConv?.userName,
        };
        const prev = imgMap.get(enriched.id);
        if (!prev || preferOverwrite || (!prev.userEmail && enriched.userEmail)) {
          imgMap.set(enriched.id, enriched);
        }
        if (enriched.conversationId && enriched.prompt) {
          seenConvPromptKeys.add(
            `${enriched.conversationId}::${enriched.prompt.trim().toLowerCase()}`
          );
        }
      };

      for (const rec of localImgs) upsertImage(rec, false);
      if (cachedSnap?.images && !hasBackend) {
        for (const rec of cachedSnap.images) upsertImage(rec, false);
      }
      if (bootstrap?.images) {
        for (const rec of bootstrap.images) upsertImage(rec, true);
      }

      // Recover any generated images embedded inside chat messages that aren't in imgMap
      for (const msg of mergedMessages) {
        const gen = msg.imageGeneration;
        if (!gen || !Array.isArray(gen.images) || gen.images.length === 0) continue;
        const key = `${msg.conversationId}::${(gen.prompt || '').trim().toLowerCase()}`;
        if (seenConvPromptKeys.has(key)) continue;
        const conv = convByIdLookup.get(msg.conversationId);
        upsertImage(
          {
            id: `chatimg-${msg.id}`,
            userId: msg.userId || conv?.userId || 'anonymous',
            userEmail: conv?.userEmail,
            userName: conv?.userName,
            conversationId: msg.conversationId,
            prompt: gen.prompt || 'Chat generated image',
            style: gen.style || 'Realistic Photography',
            aspectRatio: gen.aspectRatio || '1:1',
            quality: gen.quality || 'standard',
            count: gen.images.length,
            modelUsed: msg.modelUsed || 'Offnex Image Studio',
            provider: gen.provider || 'gemini',
            images: gen.images,
            createdAt: conv?.updatedAt || conv?.createdAt || new Date().toISOString(),
          },
          false
        );
      }

      const mergedImages = Array.from(imgMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // 5. Merge Docs, Tickets, Logs
      const docMap = new Map<string, StoredDocument>();
      for (const d of localDocs) docMap.set(d.id, d);
      if (cachedSnap?.documents && !hasBackend) {
        for (const d of cachedSnap.documents) docMap.set(d.id, d);
      }
      if (bootstrap?.documents) {
        for (const d of bootstrap.documents) docMap.set(d.id, d);
      }
      const mergedDocs = Array.from(docMap.values());

      const ticketMap = new Map<string, SupportTicket>();
      for (const t of localTickets) ticketMap.set(t.id, t);
      if (cachedSnap?.tickets && !hasBackend) {
        for (const t of cachedSnap.tickets) ticketMap.set(t.id, t);
      }
      if (bootstrap?.tickets) {
        for (const t of bootstrap.tickets) ticketMap.set(t.id, t);
      }
      const mergedTickets = Array.from(ticketMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      const logMap = new Map<string, AdminActivityLog>();
      for (const l of localLogs) logMap.set(l.id, l);
      if (cachedSnap?.logs && !hasBackend) {
        for (const l of cachedSnap.logs) logMap.set(l.id, l);
      }
      if (bootstrap?.logs) {
        for (const l of bootstrap.logs) logMap.set(l.id, l);
      }
      const mergedLogs = Array.from(logMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const effectiveSettings = bootstrap?.settings || cachedSnap?.settings || localSettings;

      setUsers(mergedUsers);
      setConversations(mergedConversations);
      setMessages(mergedMessages);
      setImages(mergedImages);
      setDocuments(mergedDocs);
      setAppSettings(effectiveSettings);
      setTickets(mergedTickets);
      setClientLogs(mergedLogs);

      if (bootstrap?.overview) {
        setOverview(bootstrap.overview);
      } else {
        const serverOverview = await fetch('/api/admin/overview')
          .then((r) => (r.ok ? (r.json() as Promise<AdminOverviewResponse>) : null))
          .catch(() => null);
        if (serverOverview) setOverview(serverOverview);
      }

      if (hasBackend) {
        writeCachedAdminSnapshot({
          users: mergedUsers,
          conversations: mergedConversations,
          messages: mergedMessages,
          images: mergedImages,
          documents: mergedDocs,
          tickets: mergedTickets,
          logs: mergedLogs,
          settings: effectiveSettings,
          savedAt: new Date().toISOString(),
        });
        const liveSnap = await fetchLiveSyncState();
        if (liveSnap?.dataRevision) {
          lastAdminRevisionRef.current = liveSnap.dataRevision;
        }
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  // Auto-sync Admin dashboard whenever backend comes back online or users/admins update data
  useEffect(() => {
    const checkAdminSync = async () => {
      if (typeof navigator === 'undefined' || !navigator.onLine) {
        setSyncStatus(readCachedAdminSnapshot() ? 'cached' : 'offline');
        return;
      }
      if (!hasBackendSyncRef.current) {
        await loadAllAdminData();
        return;
      }
      const live = await fetchLiveSyncState();
      if (!live?.dataRevision) return;
      if (lastAdminRevisionRef.current !== live.dataRevision) {
        lastAdminRevisionRef.current = live.dataRevision;
        await loadAllAdminData();
      }
    };

    const onFocus = () => void checkAdminSync();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkAdminSync();
      }
    }, 10000);

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    window.addEventListener('offline', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('offline', onFocus);
    };
  }, [loadAllAdminData]);

  // Ctrl+K global search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Deduplicated persisted server/client logs + synthesized latest events if logs are minimal
  const combinedLogs = useMemo<AdminActivityLog[]>(() => {
    const baseLogs = new Map<string, AdminActivityLog>();
    for (const l of overview?.logs || []) {
      baseLogs.set(l.id, { ...l, source: l.source || 'server' });
    }
    for (const l of clientLogs) {
      if (!baseLogs.has(l.id)) {
        baseLogs.set(l.id, l);
      }
    }
    const merged = Array.from(baseLogs.values());
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return merged;
  }, [overview?.logs, clientLogs]);

  // Top Users computed strictly from real per-user chats + images count
  const topUsersList = useMemo(() => {
    return users
      .map((u) => {
        const emailLower = u.email.toLowerCase();
        const userImgs = images.filter(
          (img) => img.userId === u.id || img.userEmail?.toLowerCase() === emailLower
        ).length;
        const userChats = conversations.filter(
          (c) => c.userId === u.id || c.userEmail?.toLowerCase() === emailLower
        ).length;
        const score = userChats + userImgs;
        return {
          user: u,
          chats: userChats,
          images: userImgs,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [users, conversations, images]);

  // Global search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ label: string; sub: string; section: AdminSection }> = [];

    SIDEBAR_ITEMS.forEach((item) => {
      if (item.label.toLowerCase().includes(q)) {
        results.push({ label: item.label, sub: 'Admin Section', section: item.id });
      }
    });
    users.forEach((u) => {
      if (`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) {
        results.push({ label: `${u.firstName} ${u.lastName}`, sub: u.email, section: 'users' });
      }
    });
    conversations.forEach((c) => {
      const hay = `${c.title} ${c.userEmail || ''} ${c.userName || ''} ${c.modelName}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          label: c.title,
          sub: `${c.userEmail || c.userName || 'Chat'} · ${c.modelName}`,
          section: 'chats',
        });
      }
    });
    images.forEach((img) => {
      const hay = `${img.prompt} ${img.style} ${img.userEmail || ''} ${img.userName || ''} ${img.provider}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          label: img.prompt.slice(0, 50),
          sub: `${img.userEmail || img.userName || 'Image'} · ${img.provider}`,
          section: 'images',
        });
      }
    });
    return results.slice(0, 8);
  }, [searchQuery, users, conversations, images]);

  // Admin Mutations (all persisted directly to backend DB + local cache)
  const handleCreateUser = async (payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    password?: string;
  }) => {
    const res = await authService.createUserByAdmin(payload);
    if (res.success && res.user) {
      setUsers(authService.getStoredUsers());
      await db.addActivityLog({
        level: 'info',
        category: 'users',
        message: `Admin created user ${res.user.email}`,
        actor: currentUser?.email || 'admin',
      });
      await loadAllAdminData();
    }
    return res;
  };

  const handleUpdateUserRole = async (id: string, role: UserRole) => {
    const next = await authService.updateUserByAdmin(id, { role });
    setUsers(next);
    await db.addActivityLog({
      level: 'info',
      category: 'users',
      message: `Updated role to ${role} for user ${id}`,
      actor: currentUser?.email || 'admin',
    });
    await loadAllAdminData();
  };

  const handleDeleteUser = async (id: string) => {
    const next = await authService.deleteUserByAdmin(id);
    setUsers(next);
    await db.addActivityLog({
      level: 'warn',
      category: 'users',
      message: `Deleted user account ${id}`,
      actor: currentUser?.email || 'admin',
    });
    await loadAllAdminData();
  };

  const handleDeleteConversation = async (id: string) => {
    await db.deleteConversation(id);
    await deleteConversationOnBackend(id);
    await db.addActivityLog({
      level: 'warn',
      category: 'chat',
      message: `Deleted conversation ${id}`,
      actor: currentUser?.email || 'admin',
    });
    await loadAllAdminData();
    await onAppDataMutated?.();
  };

  const handleDeleteImage = async (id: string) => {
    await db.adminDeleteImageRecord(id);
    await deleteImageRecordOnBackend(id);
    await db.addActivityLog({
      level: 'warn',
      category: 'image',
      message: `Removed generated image record ${id}`,
      actor: currentUser?.email || 'admin',
    });
    await loadAllAdminData();
    await onAppDataMutated?.();
  };

  const handleUpdateAppSettings = async (next: AppSettings) => {
    await db.saveSettings(next);
    await syncSettingsToBackend(next);
    setAppSettings(next);
    await db.addActivityLog({
      level: 'info',
      category: 'settings',
      message: 'Updated global system settings',
      actor: currentUser?.email || 'admin',
    });
    await loadAllAdminData();
    await onAppDataMutated?.();
  };

  const handleSaveRuntimeConfig = async (next: Partial<AdminRuntimeConfig>): Promise<boolean> => {
    try {
      const resp = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!resp.ok) return false;
      await loadAllAdminData();
      return true;
    } catch {
      return false;
    }
  };

  const handleTestProvider = async (provider: 'gemini' | 'ollama' | 'local-sd') => {
    try {
      const resp = await fetch('/api/admin/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = (await resp.json()) as { ok: boolean; message: string };
      await loadAllAdminData();
      return data;
    } catch {
      return { ok: false, message: 'Failed to reach backend test endpoint.' };
    }
  };

  const handleClearLogs = async () => {
    await Promise.all([
      db.clearActivityLogs(),
      fetch('/api/admin/logs', { method: 'DELETE' }).catch(() => null),
    ]);
    await loadAllAdminData();
  };

  const handleSaveTicket = async (ticket: SupportTicket) => {
    await db.saveSupportTicket(ticket);
    await saveTicketToBackend(ticket);
    await pushActivityLogToBackend({
      level: 'info',
      category: 'tickets',
      message: `Saved support ticket "${ticket.subject}" (${ticket.status})`,
      actor: currentUser?.email || 'admin',
    });
    await loadAllAdminData();
  };

  const handleDeleteTicket = async (id: string) => {
    await db.deleteSupportTicket(id);
    await deleteTicketOnBackend(id);
    await loadAllAdminData();
  };

  const adminName = currentUser ? currentUser.firstName : 'Admin';
  const adminInitial = getInitial(currentUser?.firstName, 'A');
  const totalGeneratedImages = images.reduce((acc, rec) => acc + Math.max(1, rec.images.length), 0);

  const geminiStatusPct = overview?.providers.geminiChat.configured || overview?.providers.geminiImage.configured ? 88 : 12;
  const openaiStatusPct = overview?.providers.openai.configured ? 72 : 10;
  const localModelsOnline = Boolean(overview?.providers.ollama.connected || overview?.providers.localSd.available);
  const localStatusPct = localModelsOnline ? 64 : 18;

  const dateRangeLabel =
    analyticsRange === '7D'
      ? 'Last 7 Days'
      : analyticsRange === '30D'
      ? 'Last 30 Days'
      : 'Last 90 Days';

  const renderSidebarNav = (isDrawer: boolean) => (
    <div className="h-full flex flex-col bg-[#0A0D1C] border-r border-white/10 select-none">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#7547FF]/40 bg-[#07091A] shadow-lg shadow-[#7547FF]/20 shrink-0">
            <img src="/assets/offnex_icon_square.png" alt="Offnex AI" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base tracking-tight leading-none truncate">
              <span className="text-white">Offnex</span>{' '}
              <span className="bg-gradient-to-r from-[#A855F7] to-[#3B82F6] bg-clip-text text-transparent">AI</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-1">Admin Panel</p>
          </div>
        </div>
        {isDrawer && (
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                if (isDrawer) setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-r from-[#7547FF] to-[#5B32E5] text-white shadow-md shadow-[#7547FF]/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
              {item.id === 'tickets' && tickets.filter((t) => t.status !== 'resolved').length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/15 text-white tabular-nums">
                  {tickets.filter((t) => t.status !== 'resolved').length}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold text-sky-300 hover:bg-sky-500/10 transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Offnex App</span>
          </button>
          {currentUser && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full flex bg-[#070914] text-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 h-full shrink-0">
        {renderSidebarNav(false)}
      </aside>

      {/* Mobile / Tablet Slide-over Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {renderSidebarNav(true)}
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Atmospheric Glow */}
        <div
          className="pointer-events-none absolute -top-24 right-0 w-[640px] h-64 opacity-45 blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 70% 30%, rgba(117, 71, 255, 0.45), rgba(37, 99, 235, 0.25) 45%, transparent 75%)',
          }}
        />

        {/* Top Bar */}
        <header className="h-16 px-4 sm:px-6 border-b border-white/10 bg-[#0A0D1C]/85 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open admin navigation"
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search Input (Ctrl + K) */}
            <div className="relative flex-1 max-w-md min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 160)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anything... (Ctrl + K)"
                className="w-full bg-[#12162A] border border-white/10 rounded-full pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#7547FF] transition"
              />

              {isSearchFocused && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#11152A] border border-white/15 shadow-2xl overflow-hidden z-40">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">No matching records found</div>
                  ) : (
                    searchResults.map((res, idx) => (
                      <button
                        key={`${res.section}-${idx}`}
                        type="button"
                        onMouseDown={() => {
                          setActiveSection(res.section);
                          setSearchQuery('');
                          setIsSearchFocused(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center justify-between gap-2 border-b border-white/5 last:border-0 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{res.label}</p>
                          <p className="text-[11px] text-slate-400 truncate">{res.sub}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void loadAllAdminData()}
              disabled={isRefreshing}
              title="Sync latest backend users, chats & images"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#A78BFA]' : ''}`} />
              <span className="hidden md:inline">
                {syncStatus === 'live' ? 'Live Sync' : syncStatus === 'cached' ? 'Cached' : 'Offline'}
              </span>
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to App
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((v) => !v)}
                aria-label="Admin notifications"
                className="relative p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {combinedLogs.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {Math.min(9, combinedLogs.length)}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#11152A] border border-white/15 shadow-2xl overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Recent System Events</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        setActiveSection('logs');
                      }}
                      className="text-[11px] font-semibold text-[#A78BFA] hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {combinedLogs.slice(0, 5).map((item) => (
                      <div key={item.id} className="px-4 py-2.5 text-xs">
                        <p className="text-slate-200 line-clamp-2">{item.message}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          {formatRelativeTime(item.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Avatar Pill (First Initial Badge) */}
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7547FF] to-[#5B32E5] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {adminInitial}
              </div>
              <span className="text-xs font-semibold text-white hidden sm:inline">
                {adminName}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Viewport (Note: block scroll container so cards never clip vertically!) */}
        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
            {isLoading ? (
              <div className="space-y-5 animate-pulse">
                <div className="h-16 rounded-2xl bg-[#101426] border border-white/10" />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 rounded-2xl bg-[#101426] border border-white/10" />
                  ))}
                </div>
                <div className="h-72 rounded-2xl bg-[#101426] border border-white/10" />
              </div>
            ) : activeSection === 'dashboard' ? (
              <>
                {/* Welcome Header + Date Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      Welcome Back, {adminName}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Here&apos;s what&apos;s happening with your Offnex AI platform today.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#101426] border border-white/10 text-xs font-semibold text-slate-200 self-start sm:self-auto shrink-0">
                    <Calendar className="w-4 h-4 text-[#A78BFA] shrink-0" />
                    <select
                      aria-label="Analytics timeframe"
                      value={analyticsRange}
                      onChange={(e) => setAnalyticsRange(e.target.value as AnalyticsRange)}
                      className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                    >
                      <option value="7D" className="bg-[#101426]">Last 7 Days</option>
                      <option value="30D" className="bg-[#101426]">Last 30 Days</option>
                      <option value="90D" className="bg-[#101426]">Last 90 Days</option>
                    </select>
                  </div>
                </div>

                {/* Maintenance Alert Banner if active */}
                {overview?.config.maintenanceMode && (
                  <div className="rounded-2xl bg-amber-500/15 border border-amber-500/35 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-200 font-medium">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Maintenance Mode is currently active — cloud chat and image requests are paused.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('api')}
                      className="text-xs font-semibold text-amber-300 hover:underline shrink-0 cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                )}

                {/* Row 1: 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {/* Card 1: Total Users */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#0F1B3D]/95 to-[#0D1326] border border-blue-500/25 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 font-medium">Total Users</p>
                        <p className="text-2xl font-extrabold text-white mt-0.5 font-mono tabular-nums">
                          {users.length}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-400 mt-1">
                          Saved on backend
                        </p>
                      </div>
                    </div>
                    <KpiSparkline
                      values={[1, Math.max(1, users.length - 1), users.length, users.length + 1]}
                      strokeColor="#3B82F6"
                      gradientId="kpiBlue"
                    />
                  </div>

                  {/* Card 2: Total Chats */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#1C143D]/95 to-[#101225] border border-purple-500/25 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 font-medium">Total Chats</p>
                        <p className="text-2xl font-extrabold text-white mt-0.5 font-mono tabular-nums">
                          {conversations.length}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-400 mt-1 font-mono tabular-nums">
                          {messages.length} messages
                        </p>
                      </div>
                    </div>
                    <KpiSparkline
                      values={[1, 2, Math.max(2, conversations.length), Math.max(3, messages.length)]}
                      strokeColor="#A855F7"
                      gradientId="kpiPurple"
                    />
                  </div>

                  {/* Card 3: Total Images */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#0D2927]/95 to-[#0D1424] border border-emerald-500/25 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 font-medium">Total Images</p>
                        <p className="text-2xl font-extrabold text-white mt-0.5 font-mono tabular-nums">
                          {totalGeneratedImages}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-400 mt-1 font-mono tabular-nums">
                          {images.length} prompts
                        </p>
                      </div>
                    </div>
                    <KpiSparkline
                      values={[0, 1, Math.max(1, images.length), Math.max(2, totalGeneratedImages)]}
                      strokeColor="#10B981"
                      gradientId="kpiGreen"
                    />
                  </div>

                  {/* Card 4: Stored Documents & Tickets */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#2B1F11]/95 to-[#121424] border border-amber-500/25 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                        <FolderKanban className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 font-medium">Knowledge Docs</p>
                        <p className="text-2xl font-extrabold text-white mt-0.5 font-mono tabular-nums">
                          {documents.length}
                        </p>
                        <p className="text-[11px] font-semibold text-amber-300 mt-1 font-mono tabular-nums">
                          {dateRangeLabel}
                        </p>
                      </div>
                    </div>
                    <KpiSparkline
                      values={[1, 1.5, Math.max(1, documents.length), Math.max(2, documents.length + 1)]}
                      strokeColor="#F59E0B"
                      gradientId="kpiAmber"
                    />
                  </div>
                </div>

                {/* Row 2: Platform Analytics (8 cols) + AI Models Status (4 cols) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <div className="xl:col-span-8 min-w-0">
                    <PlatformAnalyticsChart
                      conversations={conversations}
                      images={images}
                      users={users}
                      range={analyticsRange}
                      onRangeChange={setAnalyticsRange}
                    />
                  </div>

                  <div className="xl:col-span-4 rounded-2xl bg-[#101426]/90 border border-white/10 p-4 sm:p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#7547FF]/15 border border-[#7547FF]/30 flex items-center justify-center shrink-0">
                          <Cpu className="w-4 h-4 text-[#A78BFA]" />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white">AI Models Status</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('models')}
                        className="text-xs font-semibold text-[#A78BFA] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        Manage <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Google Gemini */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            Google Gemini
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium ${
                              overview?.providers.geminiChat.configured || overview?.providers.geminiImage.configured
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                overview?.providers.geminiChat.configured || overview?.providers.geminiImage.configured
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                            {overview?.providers.geminiChat.configured || overview?.providers.geminiImage.configured
                              ? 'Online'
                              : 'Unconfigured'}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all"
                            style={{ width: `${geminiStatusPct}%` }}
                          />
                        </div>
                      </div>

                      {/* OpenAI DALL-E */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-sky-400" />
                            OpenAI DALL-E 3
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium ${
                              overview?.providers.openai.configured ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                overview?.providers.openai.configured ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            {overview?.providers.openai.configured ? 'Online' : 'Standby'}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all"
                            style={{ width: `${openaiStatusPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Local Models */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-indigo-400" />
                            Local Models (Ollama / SD)
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium ${
                              localModelsOnline ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                localModelsOnline ? 'bg-emerald-400' : 'bg-indigo-400'
                              }`}
                            />
                            {localModelsOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                            style={{ width: `${localStatusPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>
                        RAM: {overview?.hardware.usedMemGb ?? '—'} / {overview?.hardware.totalMemGb ?? '—'} GB
                      </span>
                      <span>CPUs: {overview?.hardware.cpuCount ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Recent Activity + Top Users + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Recent Activity */}
                  <div className="lg:col-span-4 rounded-2xl bg-[#101426]/90 border border-white/10 p-4 sm:p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#A78BFA]" />
                        <h3 className="text-sm sm:text-base font-bold text-white">Recent Activity</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('logs')}
                        className="text-xs font-semibold text-[#A78BFA] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        View All <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      {combinedLogs.slice(0, 4).map((evt) => {
                        const iconBg =
                          evt.category === 'image'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : evt.category === 'chat'
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                        const EvtIcon =
                          evt.category === 'image'
                            ? ImagePlus
                            : evt.category === 'chat'
                            ? MessageCircle
                            : UserPlus;

                        return (
                          <div key={evt.id} className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${iconBg}`}
                              >
                                <EvtIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{evt.message}</p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {evt.actor || evt.category}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                              {formatRelativeTime(evt.timestamp)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Users */}
                  <div className="lg:col-span-4 rounded-2xl bg-[#101426]/90 border border-white/10 p-4 sm:p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#A78BFA]" />
                        <h3 className="text-sm sm:text-base font-bold text-white">Top Users</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('users')}
                        className="text-xs font-semibold text-[#A78BFA] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        View All <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {topUsersList.map((entry, idx) => (
                        <div
                          key={entry.user.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-[#0B0E1D] border border-white/5 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-white/5 text-[11px] font-bold text-slate-300 flex items-center justify-center font-mono shrink-0">
                              {idx + 1}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7547FF] to-[#3B82F6] text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {getInitial(entry.user.firstName, 'U')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {entry.user.firstName} {entry.user.lastName}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                                {entry.chats} chats · {entry.images} images
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                              entry.user.role === 'business_owner'
                                ? 'bg-[#7547FF]/25 text-[#C4B5FD] border border-[#7547FF]/35'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {entry.user.role === 'business_owner' ? 'Owner' : 'User'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="lg:col-span-4 rounded-2xl bg-[#101426]/90 border border-white/10 p-4 sm:p-5 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                      <Rocket className="w-4 h-4 text-[#A78BFA]" />
                      <h3 className="text-sm sm:text-base font-bold text-white">Quick Actions</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveSection('users')}
                        className="rounded-xl p-3.5 bg-gradient-to-br from-[#7547FF] to-[#5B32E5] hover:brightness-110 text-white flex flex-col items-center justify-center gap-2 transition shadow-lg shadow-[#7547FF]/25 cursor-pointer"
                      >
                        <Users className="w-5 h-5" />
                        <span className="text-xs font-semibold">Manage Users</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSection('chats')}
                        className="rounded-xl p-3.5 bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] hover:brightness-110 text-white flex flex-col items-center justify-center gap-2 transition shadow-lg shadow-blue-600/20 cursor-pointer"
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-xs font-semibold">View Chats</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSection('models')}
                        className="rounded-xl p-3.5 bg-gradient-to-br from-[#059669] to-[#047857] hover:brightness-110 text-white flex flex-col items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                      >
                        <Cpu className="w-5 h-5" />
                        <span className="text-xs font-semibold">Manage Models</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSection('settings')}
                        className="rounded-xl p-3.5 bg-gradient-to-br from-[#D97706] to-[#B45309] hover:brightness-110 text-white flex flex-col items-center justify-center gap-2 transition shadow-lg shadow-amber-600/20 cursor-pointer"
                      >
                        <Settings className="w-5 h-5" />
                        <span className="text-xs font-semibold">System Settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <AdminSubViews
                section={activeSection}
                users={users}
                conversations={conversations}
                messages={messages}
                images={images}
                documents={documents}
                appSettings={appSettings}
                overview={overview}
                logs={combinedLogs}
                tickets={tickets}
                syncStatus={syncStatus}
                onCreateUser={handleCreateUser}
                onUpdateUserRole={handleUpdateUserRole}
                onDeleteUser={handleDeleteUser}
                onDeleteConversation={handleDeleteConversation}
                onDeleteImage={handleDeleteImage}
                onUpdateAppSettings={handleUpdateAppSettings}
                onSaveRuntimeConfig={handleSaveRuntimeConfig}
                onTestProvider={handleTestProvider}
                onClearLogs={handleClearLogs}
                onRefreshAll={loadAllAdminData}
                onSaveTicket={handleSaveTicket}
                onDeleteTicket={handleDeleteTicket}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
