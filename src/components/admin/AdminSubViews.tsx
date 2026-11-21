'use client';

import React, { useMemo, useState } from 'react';
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
  SupportedLanguage,
  UserProfile,
  UserRole,
} from '../../types';
import {
  Users,
  Search,
  UserPlus,
  Trash2,
  MessageSquare,
  Download,
  Eye,
  Image as ImageIcon,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Settings as SettingsIcon,
  Activity,
  LifeBuoy,
  X,
  Plus,
  Server,
  ShieldAlert,
  Database,
  HardDrive,
} from 'lucide-react';
import { db } from '../../services/db';

interface AdminSubViewsProps {
  section: Exclude<AdminSection, 'dashboard'>;
  users: UserProfile[];
  conversations: Conversation[];
  messages: Message[];
  images: GeneratedImageRecord[];
  documents: StoredDocument[];
  appSettings: AppSettings;
  overview: AdminOverviewResponse | null;
  logs: AdminActivityLog[];
  tickets: SupportTicket[];
  onCreateUser: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    password?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateUserRole: (id: string, role: UserRole) => void;
  onDeleteUser: (id: string) => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onDeleteImage: (id: string) => Promise<void>;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onSaveRuntimeConfig: (next: Partial<AdminRuntimeConfig>) => Promise<boolean>;
  onTestProvider: (provider: 'gemini' | 'ollama' | 'local-sd') => Promise<{ ok: boolean; message: string }>;
  onClearLogs: () => Promise<void>;
  onRefreshAll: () => Promise<void>;
  onSaveTicket: (ticket: SupportTicket) => Promise<void>;
  onDeleteTicket: (id: string) => Promise<void>;
}

function getInitials(name?: string, fallback = 'U'): string {
  const clean = (name || '').trim();
  return clean ? clean.charAt(0).toUpperCase() : fallback;
}

export const AdminSubViews: React.FC<AdminSubViewsProps> = ({
  section,
  users,
  conversations,
  messages,
  images,
  documents,
  appSettings,
  overview,
  logs,
  tickets,
  onCreateUser,
  onUpdateUserRole,
  onDeleteUser,
  onDeleteConversation,
  onDeleteImage,
  onUpdateAppSettings,
  onSaveRuntimeConfig,
  onTestProvider,
  onClearLogs,
  onRefreshAll,
  onSaveTicket,
  onDeleteTicket,
}) => {
  // Users state
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'user' as UserRole,
    password: '',
  });
  const [userFormErr, setUserFormErr] = useState<string | null>(null);

  // Chats state
  const [chatSearch, setChatSearch] = useState('');
  const [inspectConvId, setInspectConvId] = useState<string | null>(null);

  // Images state
  const [imgSearch, setImgSearch] = useState('');
  const [imgProviderFilter, setImgProviderFilter] = useState<'all' | 'gemini' | 'openai' | 'local'>('all');
  const [previewImg, setPreviewImg] = useState<{ url: string; prompt: string; model: string } | null>(null);

  // Models / API config state
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [configDraft, setConfigDraft] = useState<AdminRuntimeConfig | null>(null);
  const [configSavedNotice, setConfigSavedNotice] = useState<string | null>(null);

  // Settings state
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  // Logs state
  const [logSearch, setLogSearch] = useState('');
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  // Tickets state
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    userName: '',
    userEmail: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    message: '',
  });

  const activeConfig: AdminRuntimeConfig = configDraft ||
    overview?.config || {
      defaultChatModel: 'gemini-3.1-flash-lite',
      defaultImageModel: 'gemini-2.5-flash-image',
      highQualityImageModel: 'gemini-nano-banana-2.1',
      imageRateLimitMax: 10,
      imageRateLimitWindowMinutes: 1440,
      maintenanceMode: false,
      allowLocalFallback: true,
      ollamaHost: 'http://localhost:11434',
    };

  const handleRunProviderTest = async (provider: 'gemini' | 'ollama' | 'local-sd') => {
    setTestingTarget(provider);
    const res = await onTestProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: res }));
    setTestingTarget(null);
  };

  // ==================== USERS ====================
  if (section === 'users') {
    const filteredUsers = users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const q = userSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#A78BFA]" />
              Users Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage registered accounts, roles, and access permissions ({users.length} total).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setUserFormErr(null);
              setShowAddUser(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7547FF] to-[#5B32E5] text-white text-xs font-semibold hover:brightness-110 transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full bg-[#101426] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#7547FF]"
            />
          </div>
          <div className="inline-flex bg-[#101426] border border-white/10 rounded-xl p-1 gap-1 shrink-0">
            {(['all', 'user', 'business_owner'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  roleFilter === r ? 'bg-[#7547FF] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All Roles' : r === 'business_owner' ? 'Business Owner' : 'User'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-[#101426] border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0B0E1C]">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  <th className="py-3 px-4 font-semibold">Last Active</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      No matching users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7547FF] to-[#3B82F6] text-white font-bold text-sm flex items-center justify-center shrink-0">
                            {getInitials(u.firstName, 'U')}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => onUpdateUserRole(u.id, e.target.value as UserRole)}
                          className="bg-[#090C18] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#7547FF] cursor-pointer"
                        >
                          <option value="user">User</option>
                          <option value="business_owner">Business Owner</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono tabular-nums">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteUser(u.id)}
                          title="Delete User"
                          className="inline-flex items-center justify-center p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#11152A] border border-white/15 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Create User Account</h3>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {userFormErr && (
                <div className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-xl px-3 py-2">
                  {userFormErr}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={newUserForm.firstName}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={newUserForm.lastName}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  className="bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="user">User</option>
                  <option value="business_owner">Business Owner</option>
                </select>
                <input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))}
                  className="bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await onCreateUser(newUserForm);
                    if (!res.success) {
                      setUserFormErr(res.error || 'Could not create user');
                      return;
                    }
                    setNewUserForm({ firstName: '', lastName: '', email: '', role: 'user', password: '' });
                    setShowAddUser(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#7547FF] text-white hover:brightness-110 cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== CHATS ====================
  if (section === 'chats') {
    const filteredConvs = conversations.filter((c) => {
      const q = chatSearch.trim().toLowerCase();
      return (
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.modelName.toLowerCase().includes(q) ||
        c.language.toLowerCase().includes(q)
      );
    });

    const inspectedMessages = inspectConvId
      ? messages.filter((m) => m.conversationId === inspectConvId)
      : [];
    const inspectedConv = conversations.find((c) => c.id === inspectConvId);

    const exportMarkdown = (conv: Conversation) => {
      const convMsgs = messages.filter((m) => m.conversationId === conv.id);
      const md = [
        `# ${conv.title}`,
        `Model: ${conv.modelName} | Language: ${conv.language} | Updated: ${conv.updatedAt}`,
        '',
        ...convMsgs.map((m) => `### ${m.role.toUpperCase()} (${m.timestamp})\n${m.content}`),
      ].join('\n\n');
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conv.title.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#A78BFA]" />
              Chat Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect stored conversations, export transcripts, or remove threads ({conversations.length} conversations ·{' '}
              {messages.length} messages).
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search conversations by title, model, or language..."
            className="w-full bg-[#101426] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#7547FF]"
          />
        </div>

        <div className="rounded-2xl bg-[#101426] border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0B0E1C]">
                  <th className="py-3 px-4 font-semibold">Conversation Title</th>
                  <th className="py-3 px-4 font-semibold">Model</th>
                  <th className="py-3 px-4 font-semibold">Messages</th>
                  <th className="py-3 px-4 font-semibold">Updated</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredConvs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No conversations match your search.
                    </td>
                  </tr>
                ) : (
                  filteredConvs.map((conv) => {
                    const actualCount = messages.filter((m) => m.conversationId === conv.id).length || conv.messagesCount;
                    return (
                      <tr key={conv.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-medium text-white">{conv.title}</td>
                        <td className="py-3 px-4 text-xs text-slate-300 font-mono">{conv.modelName}</td>
                        <td className="py-3 px-4 text-xs text-slate-300 font-mono tabular-nums">{actualCount}</td>
                        <td className="py-3 px-4 text-xs text-slate-400 font-mono tabular-nums">
                          {new Date(conv.updatedAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => setInspectConvId(conv.id)}
                            title="Inspect messages"
                            className="inline-flex items-center justify-center p-2 rounded-lg text-indigo-300 hover:bg-indigo-500/15 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportMarkdown(conv)}
                            title="Export Markdown"
                            className="inline-flex items-center justify-center p-2 rounded-lg text-emerald-300 hover:bg-emerald-500/15 cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteConversation(conv.id)}
                            title="Delete Conversation"
                            className="inline-flex items-center justify-center p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Thread Inspector Modal */}
        {inspectConvId && inspectedConv && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-[#101426] border border-white/15 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{inspectedConv.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">{inspectedConv.modelName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectConvId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {inspectedMessages.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No messages recorded in this thread yet.</p>
                ) : (
                  inspectedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-3.5 border text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#191E38] border-[#7547FF]/30 text-white'
                          : 'bg-[#0B0E1C] border-white/10 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
                        <span className="uppercase font-semibold text-indigo-300">{msg.role}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content || '(Image generation output)'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== IMAGES ====================
  if (section === 'images') {
    const filteredImgs = images.filter((rec) => {
      const matchesProvider = imgProviderFilter === 'all' || rec.provider === imgProviderFilter;
      const q = imgSearch.trim().toLowerCase();
      const matchesQuery =
        !q || rec.prompt.toLowerCase().includes(q) || rec.style.toLowerCase().includes(q);
      return matchesProvider && matchesQuery;
    });

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-400" />
            Image Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review all AI-generated images across users and manage local storage ({images.length} records).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={imgSearch}
              onChange={(e) => setImgSearch(e.target.value)}
              placeholder="Filter generated images by prompt or style..."
              className="w-full bg-[#101426] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#7547FF]"
            />
          </div>
          <div className="inline-flex bg-[#101426] border border-white/10 rounded-xl p-1 gap-1 shrink-0 overflow-x-auto">
            {(['all', 'gemini', 'openai', 'local'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setImgProviderFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer whitespace-nowrap ${
                  imgProviderFilter === p ? 'bg-[#7547FF] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'all' ? 'All Providers' : p}
              </button>
            ))}
          </div>
        </div>

        {filteredImgs.length === 0 ? (
          <div className="rounded-2xl bg-[#101426] border border-white/10 p-12 text-center">
            <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-300">No generated images found</p>
            <p className="text-xs text-slate-500 mt-1">
              Images generated from the main Offnex AI studio will appear here for moderation and inspection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredImgs.map((rec) => {
              const firstImg = rec.images[0]?.dataUrl;
              return (
                <div
                  key={rec.id}
                  className="rounded-2xl bg-[#101426] border border-white/10 overflow-hidden flex flex-col"
                >
                  <div className="aspect-video bg-[#080B16] relative overflow-hidden group">
                    {firstImg ? (
                      <img
                        src={firstImg}
                        alt={rec.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        No preview
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/65 border border-white/10 text-[10px] font-mono uppercase text-slate-200">
                      {rec.provider} · {rec.aspectRatio}
                    </div>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-white line-clamp-2">{rec.prompt}</p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                        {rec.style} · {new Date(rec.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() =>
                          firstImg &&
                          setPreviewImg({ url: firstImg, prompt: rec.prompt, model: rec.modelUsed })
                        }
                        className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteImage(rec.id)}
                        className="text-xs font-semibold text-rose-400 hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {previewImg && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-2xl w-full rounded-2xl bg-[#101426] border border-white/15 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">{previewImg.model}</span>
                <button
                  type="button"
                  onClick={() => setPreviewImg(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-black flex items-center justify-center max-h-[65vh] overflow-hidden">
                <img src={previewImg.url} alt={previewImg.prompt} className="max-h-[65vh] object-contain" />
              </div>
              <div className="p-4 text-xs text-slate-300">{previewImg.prompt}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== AI MODELS & API CONFIGURATION ====================
  if (section === 'models' || section === 'api') {
    const providersList = [
      {
        id: 'gemini',
        name: 'Google Gemini (Chat & Image)',
        online: Boolean(overview?.providers.geminiChat.configured || overview?.providers.geminiImage.configured),
        detail: `Chat: ${overview?.providers.geminiChat.model || activeConfig.defaultChatModel} · Image: ${
          overview?.providers.geminiImage.modelStandard || activeConfig.defaultImageModel
        }`,
        source: overview?.providers.geminiImage.keySource || 'none',
        testKey: 'gemini' as const,
      },
      {
        id: 'openai',
        name: 'OpenAI DALL-E 3 (Fallback)',
        online: Boolean(overview?.providers.openai.configured),
        detail: overview?.providers.openai.configured
          ? 'OPENAI_API_KEY active on server'
          : 'Not configured in server environment',
        source: overview?.providers.openai.configured ? 'OPENAI_API_KEY' : 'none',
        testKey: null,
      },
      {
        id: 'ollama',
        name: 'Local Ollama Engine',
        online: Boolean(overview?.providers.ollama.connected),
        detail: overview?.providers.ollama.connected
          ? `Connected v${overview.providers.ollama.version || ''} at ${overview.providers.ollama.host}`
          : `Offline (${overview?.providers.ollama.host || activeConfig.ollamaHost})`,
        source: 'local',
        testKey: 'ollama' as const,
      },
      {
        id: 'local-sd',
        name: 'Local Stable Diffusion',
        online: Boolean(overview?.providers.localSd.available),
        detail: overview?.providers.localSd.available
          ? `${overview.providers.localSd.modelsCount} checkpoints ready at ${overview.providers.localSd.endpoint}`
          : overview?.providers.localSd.error || 'Offline on 127.0.0.1:7860',
        source: 'local',
        testKey: 'local-sd' as const,
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {section === 'models' ? <Cpu className="w-5 h-5 text-[#A78BFA]" /> : <KeyRound className="w-5 h-5 text-[#A78BFA]" />}
              {section === 'models' ? 'AI Models & Engines' : 'API & Runtime Configuration'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live server provider diagnostics, connectivity checks, rate limits, and runtime routing controls.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Status
          </button>
        </div>

        {/* Provider Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providersList.map((prov) => {
            const testResult = prov.testKey ? testResults[prov.testKey] : undefined;
            return (
              <div
                key={prov.id}
                className="rounded-2xl bg-[#101426] border border-white/10 p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          prov.online ? 'bg-emerald-400 shadow-sm shadow-emerald-400/60' : 'bg-slate-500'
                        }`}
                      />
                      <h3 className="text-sm font-bold text-white">{prov.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{prov.detail}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                      prov.online
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-white/10'
                    }`}
                  >
                    {prov.online ? 'Online' : 'Offline'}
                  </span>
                </div>

                {testResult && (
                  <div
                    className={`text-xs rounded-xl px-3 py-2 border ${
                      testResult.ok
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                  <span className="text-slate-500 font-mono">Source: {prov.source}</span>
                  {prov.testKey && (
                    <button
                      type="button"
                      disabled={testingTarget === prov.testKey}
                      onClick={() => handleRunProviderTest(prov.testKey!)}
                      className="px-3 py-1.5 rounded-lg bg-[#7547FF]/20 text-[#C4B5FD] hover:bg-[#7547FF]/30 font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {testingTarget === prov.testKey ? 'Testing...' : 'Test Connection'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Runtime Config Editor */}
        <div className="rounded-2xl bg-[#101426] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Runtime Model & Quota Policy</h3>
              <p className="text-xs text-slate-400">
                Changes apply immediately to backend endpoints without restarting the server.
              </p>
            </div>
            {configSavedNotice && (
              <span className="text-xs font-semibold text-emerald-400">{configSavedNotice}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Default Chat Model</span>
              <input
                type="text"
                value={activeConfig.defaultChatModel}
                onChange={(e) =>
                  setConfigDraft({ ...activeConfig, defaultChatModel: e.target.value })
                }
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Standard Image Model</span>
              <input
                type="text"
                value={activeConfig.defaultImageModel}
                onChange={(e) =>
                  setConfigDraft({ ...activeConfig, defaultImageModel: e.target.value })
                }
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Daily Image Limit (Max / Window)</span>
              <input
                type="number"
                min={1}
                max={200}
                value={activeConfig.imageRateLimitMax}
                onChange={(e) =>
                  setConfigDraft({ ...activeConfig, imageRateLimitMax: Number(e.target.value) || 10 })
                }
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Limit Window (Minutes, 1440 = 1 Day)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={activeConfig.imageRateLimitWindowMinutes}
                onChange={(e) =>
                  setConfigDraft({
                    ...activeConfig,
                    imageRateLimitWindowMinutes: Number(e.target.value) || 1440,
                  })
                }
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono tabular-nums"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={activeConfig.maintenanceMode}
                onChange={(e) =>
                  setConfigDraft({ ...activeConfig, maintenanceMode: e.target.checked })
                }
                className="w-4 h-4 accent-[#7547FF] rounded"
              />
              <div>
                <span className="text-sm font-semibold text-white block">Maintenance Mode</span>
                <span className="text-[11px] text-slate-400">
                  Pause cloud AI chat & image generation endpoints cleanly
                </span>
              </div>
            </label>

            <button
              type="button"
              onClick={async () => {
                const ok = await onSaveRuntimeConfig(activeConfig);
                setConfigSavedNotice(ok ? 'Configuration saved live' : 'Failed to save configuration');
                setTimeout(() => setConfigSavedNotice(null), 3000);
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7547FF] to-[#5B32E5] text-white text-xs font-semibold hover:brightness-110 cursor-pointer"
            >
              Save Backend Config
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SYSTEM SETTINGS ====================
  if (section === 'settings') {
    const handleToggleSetting = async <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
      await onUpdateAppSettings({ ...appSettings, [key]: val });
      setSettingsSavedMsg('Saved to IndexedDB');
      setTimeout(() => setSettingsSavedMsg(null), 2000);
    };

    const handleBackupDownload = async () => {
      const json = await db.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offnex_ai_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
              System Settings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Global application defaults stored locally in browser IndexedDB.
            </p>
          </div>
          {settingsSavedMsg && (
            <span className="text-xs font-semibold text-emerald-400">{settingsSavedMsg}</span>
          )}
        </div>

        <div className="rounded-2xl bg-[#101426] border border-white/10 p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Default Assistant Language</span>
              <select
                value={appSettings.language}
                onChange={(e) => handleToggleSetting('language', e.target.value as SupportedLanguage)}
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                <option value="ur">Urdu (اردو)</option>
                <option value="roman_ur">Roman Urdu</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="hi">Hindi</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Workspace Theme</span>
              <select
                value={appSettings.theme}
                onChange={(e) => handleToggleSetting('theme', e.target.value as 'dark' | 'light')}
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                <option value="dark">Obsidian Dark</option>
                <option value="light">Clean Light</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">
                Temperature ({appSettings.temperature.toFixed(1)})
              </span>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.1}
                value={appSettings.temperature}
                onChange={(e) => handleToggleSetting('temperature', Number(e.target.value))}
                className="w-full accent-[#7547FF]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Context Window</span>
              <select
                value={appSettings.contextWindow}
                onChange={(e) => handleToggleSetting('contextWindow', Number(e.target.value))}
                className="w-full bg-[#090C18] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
              >
                <option value={2048}>2,048 tokens</option>
                <option value={4096}>4,096 tokens</option>
                <option value={8192}>8,192 tokens</option>
                <option value={16384}>16,384 tokens</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#0A0D1C] border border-white/5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Offline Strict Mode</span>
              <input
                type="checkbox"
                checked={appSettings.offlineStrict}
                onChange={(e) => handleToggleSetting('offlineStrict', e.target.checked)}
                className="w-4 h-4 accent-[#7547FF]"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#0A0D1C] border border-white/5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Auto-Save History</span>
              <input
                type="checkbox"
                checked={appSettings.autoSaveHistory}
                onChange={(e) => handleToggleSetting('autoSaveHistory', e.target.checked)}
                className="w-4 h-4 accent-[#7547FF]"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#0A0D1C] border border-white/5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Sound Effects</span>
              <input
                type="checkbox"
                checked={appSettings.enableSoundEffects}
                onChange={(e) => handleToggleSetting('enableSoundEffects', e.target.checked)}
                className="w-4 h-4 accent-[#7547FF]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
            <p className="text-xs text-slate-400">Download full IndexedDB database snapshot (JSON).</p>
            <button
              type="button"
              onClick={handleBackupDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Export Full Backup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ANALYTICS ====================
  if (section === 'analytics') {
    const providerCounts = images.reduce<Record<string, number>>((acc, rec) => {
      acc[rec.provider] = (acc[rec.provider] || 0) + rec.images.length;
      return acc;
    }, {});

    const userMsgs = messages.filter((m) => m.role === 'user').length;
    const assistantMsgs = messages.filter((m) => m.role === 'assistant').length;
    const docsMb = Math.round((documents.reduce((acc, d) => acc + d.size, 0) / (1024 * 1024)) * 100) / 100;
    const ramUsedPct = overview?.hardware.totalMemGb
      ? Math.min(100, Math.round((overview.hardware.usedMemGb / overview.hardware.totalMemGb) * 100))
      : 0;

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#A78BFA]" />
            Platform Analytics & Hardware Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live breakdown of client IndexedDB storage, message roles, image providers, and Node host resources.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#101426] border border-white/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Server className="w-4 h-4 text-sky-400" /> Server Hardware
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Platform</span>
                <span className="font-mono">{overview?.hardware.platform || 'linux'} ({overview?.hardware.arch || 'x64'})</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>CPU Cores</span>
                <span className="font-mono tabular-nums">{overview?.hardware.cpuCount ?? '—'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Memory Used</span>
                <span className="font-mono tabular-nums">
                  {overview?.hardware.usedMemGb ?? 0} / {overview?.hardware.totalMemGb ?? 0} GB ({ramUsedPct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500"
                  style={{ width: `${ramUsedPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#101426] border border-white/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Database className="w-4 h-4 text-purple-400" /> Conversation Breakdown
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Conversations</span>
                <span className="font-mono tabular-nums">{conversations.length}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>User Prompts</span>
                <span className="font-mono tabular-nums">{userMsgs}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>AI Responses</span>
                <span className="font-mono tabular-nums">{assistantMsgs}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Uploaded Docs</span>
                <span className="font-mono tabular-nums">{documents.length} ({docsMb} MB)</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#101426] border border-white/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <HardDrive className="w-4 h-4 text-emerald-400" /> Image Providers Used
            </div>
            <div className="space-y-2 text-xs">
              {(['gemini', 'openai', 'local'] as const).map((p) => (
                <div key={p} className="flex justify-between text-slate-300">
                  <span className="capitalize">{p}</span>
                  <span className="font-mono tabular-nums">{providerCounts[p] || 0} images</span>
                </div>
              ))}
              <div className="flex justify-between text-slate-400 pt-2 border-t border-white/5">
                <span>Total Generations</span>
                <span className="font-mono tabular-nums text-white font-semibold">{images.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== LOGS & ACTIVITY ====================
  if (section === 'logs') {
    const filteredLogs = logs.filter((item) => {
      const matchesLevel = logLevel === 'all' || item.level === logLevel;
      const q = logSearch.trim().toLowerCase();
      const matchesQ =
        !q ||
        item.message.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.actor || '').toLowerCase().includes(q);
      return matchesLevel && matchesQ;
    });

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-sky-400" />
              Logs & Activity
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time backend API execution logs and client workspace events ({logs.length} entries).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefreshAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              type="button"
              onClick={onClearLogs}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Logs
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filter logs by message, category, or actor..."
              className="w-full bg-[#101426] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#7547FF]"
            />
          </div>
          <div className="inline-flex bg-[#101426] border border-white/10 rounded-xl p-1 gap-1 shrink-0">
            {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLogLevel(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase cursor-pointer ${
                  logLevel === lvl ? 'bg-[#7547FF] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#101426] border border-white/10 divide-y divide-white/5">
          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No activity logs recorded yet.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-500/20 text-rose-300'
                        : log.level === 'warn'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {log.level}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-white break-words">{log.message}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {log.category} · {log.source || 'server'} {log.actor ? `· ${log.actor}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ==================== SUPPORT TICKETS ====================
  const filteredTickets = tickets.filter(
    (t) => ticketFilter === 'all' || t.status === ticketFilter
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-[#A78BFA]" />
            Support Tickets
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track user inquiries, bug reports, and administrative resolutions ({tickets.length} total).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewTicket(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7547FF] to-[#5B32E5] text-white text-xs font-semibold hover:brightness-110 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      <div className="inline-flex bg-[#101426] border border-white/10 rounded-xl p-1 gap-1">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setTicketFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
              ticketFilter === st ? 'bg-[#7547FF] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="rounded-2xl bg-[#101426] border border-white/10 p-10 text-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-white">No tickets in this queue</p>
          <p className="text-xs text-slate-400 mt-1">Create a support ticket to log an issue or user request.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl bg-[#101426] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{t.subject}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      t.priority === 'high'
                        ? 'bg-rose-500/20 text-rose-300'
                        : t.priority === 'medium'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{t.message}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {t.userName} ({t.userEmail}) · {new Date(t.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={t.status}
                  onChange={(e) =>
                    onSaveTicket({
                      ...t,
                      status: e.target.value as SupportTicket['status'],
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="bg-[#090C18] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button
                  type="button"
                  onClick={() => onDeleteTicket(t.id)}
                  className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                  title="Delete ticket"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewTicket && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#11152A] border border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Create Support Ticket</h3>
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Ticket subject"
              value={newTicket.subject}
              onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))}
              className="w-full bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="User name"
                value={newTicket.userName}
                onChange={(e) => setNewTicket((p) => ({ ...p, userName: e.target.value }))}
                className="bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              />
              <input
                type="email"
                placeholder="User email"
                value={newTicket.userEmail}
                onChange={(e) => setNewTicket((p) => ({ ...p, userEmail: e.target.value }))}
                className="bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>
            <select
              value={newTicket.priority}
              onChange={(e) =>
                setNewTicket((p) => ({ ...p, priority: e.target.value as 'low' | 'medium' | 'high' }))
              }
              className="w-full bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <textarea
              rows={3}
              placeholder="Issue description..."
              value={newTicket.message}
              onChange={(e) => setNewTicket((p) => ({ ...p, message: e.target.value }))}
              className="w-full bg-[#0A0D1C] border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newTicket.subject.trim()) return;
                  const now = new Date().toISOString();
                  await onSaveTicket({
                    id: `tkt-${Date.now()}`,
                    subject: newTicket.subject.trim(),
                    userName: newTicket.userName.trim() || 'Admin',
                    userEmail: newTicket.userEmail.trim() || 'admin@offnex.ai',
                    priority: newTicket.priority,
                    status: 'open',
                    message: newTicket.message.trim() || 'Logged from Admin Panel.',
                    createdAt: now,
                    updatedAt: now,
                  });
                  setNewTicket({ subject: '', userName: '', userEmail: '', priority: 'medium', message: '' });
                  setShowNewTicket(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#7547FF] text-white hover:brightness-110 cursor-pointer"
              >
                Save Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
