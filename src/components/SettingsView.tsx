'use client';

import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Cpu,
  Moon,
  Sun,
  WifiOff,
  Wifi,
  Save,
  ChevronRight,
  LogOut,
  Download,
  CheckCircle2,
  Smartphone,
  Monitor,
  Share2,
  X,
  ExternalLink,
  LifeBuoy,
  Send,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { AppSettings, SupportTicket, SupportedLanguage, UserProfile } from '../types';
import { DevicePlatform, usePWAInstall } from '../hooks/usePWAInstall';
import { db } from '../services/db';
import { fetchUserTicketsFromBackend, saveTicketToBackend } from '../services/backendSync';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onOpenModelManager: () => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  initialOpenInstall?: boolean;
  onClearAutoOpenInstall?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onOpenModelManager,
  language,
  setLanguage,
  currentUser,
  onLogout,
  initialOpenInstall = false,
  onClearAutoOpenInstall,
}) => {
  const [autoSave, setAutoSave] = useState(settings.autoSaveHistory);
  const { isInstallable, isInstalled, platform, isEmbedded, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<DevicePlatform>(platform);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [directInstallUrl, setDirectInstallUrl] = useState<string>('/?install=1');
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);

  React.useEffect(() => {
    setSelectedPlatform(platform);
  }, [platform]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setDirectInstallUrl(`${window.location.origin}/?install=1`);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    async function loadMyTickets() {
      const backendList = await fetchUserTicketsFromBackend(
        currentUser?.id,
        currentUser?.email
      );
      if (active && backendList) {
        setMyTickets(backendList);
      } else if (active) {
        await db.init();
        const local = await db.getSupportTickets();
        const filtered = local.filter(
          (t) =>
            (currentUser?.id && t.userId === currentUser.id) ||
            (currentUser?.email && t.userEmail.toLowerCase() === currentUser.email.toLowerCase())
        );
        if (active) setMyTickets(filtered);
      }
    }
    loadMyTickets();
    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.email]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim() || ticketSubmitting) return;
    setTicketSubmitting(true);
    setTicketNotice(null);
    const now = new Date().toISOString();
    const fullName = currentUser
      ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim()
      : 'User';
    const newTicket: SupportTicket = {
      id: `tkt-${Date.now()}`,
      userId: currentUser?.id,
      userName: fullName || 'User',
      userEmail: currentUser?.email || 'user@offnex.ai',
      subject: ticketSubject.trim(),
      priority: ticketPriority,
      status: 'open',
      message: ticketMessage.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await db.saveSupportTicket(newTicket);
    const saved = (await saveTicketToBackend(newTicket)) || newTicket;
    setMyTickets((prev) => [saved, ...prev]);
    setTicketSubject('');
    setTicketMessage('');
    setTicketSubmitting(false);
    setTicketNotice('Support ticket backend mein save ho gaya hai.');
    setTimeout(() => setTicketNotice(null), 4000);
  };

  React.useEffect(() => {
    if (initialOpenInstall) {
      setShowInstallModal(true);
      onClearAutoOpenInstall?.();
    }
  }, [initialOpenInstall, onClearAutoOpenInstall]);

  const handleInstallClick = async () => {
    if (isInstalled) return;
    setInstallFeedback(null);
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    setShowInstallModal(true);
  };

  const handleModalPlatformInstall = async () => {
    setInstallFeedback(null);
    if (isInstallable && selectedPlatform !== 'ios') {
      const outcome = await install();
      if (outcome === 'accepted') {
        setShowInstallModal(false);
        return;
      }
      if (outcome === 'dismissed') {
        setInstallFeedback('Install prompt cancel hua — aap dobara click kar ke install kar sakte hain.');
        return;
      }
    }

    if (selectedPlatform === 'ios') {
      setInstallFeedback('iPhone / iPad Safari mein neeche Share (□↑) → Add to Home Screen par tap karein.');
    } else if (selectedPlatform === 'android') {
      setInstallFeedback('Android Chrome menu (⋮) → Add to Home screen → Install par tap karein.');
    } else {
      setInstallFeedback('Chrome ya Edge ke address bar mein right side par Install App icon par click karein.');
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-[#0B0D18] overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 pb-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F243D] mb-5 sm:mb-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">Application Settings</h2>
              <p className="text-xs text-gray-400 truncate">Offline preferences &amp; local AI configuration</p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#171B36] to-[#12162B] border border-purple-500/20 shadow-md mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              aria-label={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User Avatar'}
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] flex items-center justify-center text-lg font-extrabold text-white uppercase shrink-0 shadow-lg shadow-purple-600/30 border border-purple-400/30 select-none"
            >
              {(
                currentUser?.firstName?.trim()?.[0] ||
                currentUser?.lastName?.trim()?.[0] ||
                currentUser?.email?.trim()?.[0] ||
                'U'
              ).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Rizwan Ahmad'}
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {currentUser?.email || 'rizwan@gmail.com'} • Local Account
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {currentUser?.role === 'business_owner' && (
              <Link
                href="/admin"
                className="w-full sm:w-auto min-h-[40px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </Link>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto min-h-[40px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Preferences List */}
        <div className="space-y-3 sm:space-y-4">
          {/* Language Item */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Globe className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Language</div>
                <div className="text-[11px] text-gray-400">Application interface and response default</div>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              aria-label="Application Interface Language"
              className="w-full sm:w-auto min-h-[40px] bg-[#1A1F38] text-xs text-gray-200 border border-[#272D50] rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer shrink-0"
            >
              <option value="ur">Urdu (اردو)</option>
              <option value="en">English</option>
              <option value="roman_ur">Roman Urdu</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          {/* AI Models Item */}
          <div
            onClick={onOpenModelManager}
            className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] hover:border-purple-500/40 flex items-center justify-between gap-3 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Cpu className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">AI Models</div>
                <div className="text-[11px] text-gray-400 truncate">Current: {settings.defaultModel}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-300 shrink-0 whitespace-nowrap">
              <span>Manage</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Theme */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {settings.theme === 'dark' ? (
                <Moon className="w-5 h-5 text-purple-400 shrink-0" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Theme</div>
                <div className="text-[11px] text-gray-400 truncate">
                  {settings.theme === 'dark' ? 'Dark Mode (#0B0D18 Deep Obsidian)' : 'Light Mode (#FFFFFF Pure White)'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
                onUpdateSettings({ ...settings, theme: nextTheme });
              }}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1F38] hover:bg-[#252C52] border border-[#272D50] text-xs font-semibold text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Offline Mode Toggle */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {settings.offlineStrict ? (
                <WifiOff className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Wifi className="w-5 h-5 text-blue-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Offline Mode</div>
                <div className="text-[11px] text-gray-400">
                  {settings.offlineStrict
                    ? '100% Offline Active (Chat, Images, Voice & Docs without internet)'
                    : 'Online connected mode (Auto-switches offline if network drops)'}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle Offline Mode"
              onClick={() => {
                const nextVal = !settings.offlineStrict;
                onUpdateSettings({ ...settings, offlineStrict: nextVal });
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                settings.offlineStrict ? 'bg-purple-600' : 'bg-blue-600'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.offlineStrict ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Save Chat History Toggle */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Save className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Auto Save Chat History</div>
                <div className="text-[11px] text-gray-400">Persist conversations to local storage</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle Auto Save Chat History"
              onClick={() => {
                setAutoSave(!autoSave);
                onUpdateSettings({ ...settings, autoSaveHistory: !autoSave });
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                autoSave ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  autoSave ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Install Offnex Ai on Mobile & PC */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] hover:border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/assets/offnex_icon_square.png"
                  alt="Offnex Ai App Icon"
                  className="w-7 h-7 object-contain rounded-lg"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Install Offnex Ai App</span>
                  <span className="text-[10px] font-medium text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded-md">
                    Mobile &amp; PC
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  {isInstalled
                    ? 'Installed on this device as a standalone app'
                    : isInstallable
                    ? 'Ready to install directly on your Mobile or PC'
                    : 'Install on Android, iPhone/iPad, Windows, or Mac for quick access'}
                </div>
              </div>
            </div>

            {isInstalled ? (
              <div className="w-full sm:w-auto min-h-[38px] flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shrink-0 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4" />
                <span>Installed</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full sm:w-auto min-h-[38px] flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span className="text-white">{isInstallable ? 'Install Now' : 'Install App'}</span>
              </button>
            )}
          </div>

          {/* Support Ticket Submission & History */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#14182D] border border-[#222846] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-4 h-4 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">Help &amp; Support Ticket</div>
                  <div className="text-[11px] text-gray-400">
                    Kisi bhi maslay ya feedback ke liye direct support ticket submit karein
                  </div>
                </div>
              </div>
              {ticketNotice && (
                <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                  {ticketNotice}
                </span>
              )}
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Subject (e.g. Account / Image issue)"
                  className="sm:col-span-2 bg-[#1A1F38] border border-[#272D50] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                />
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="bg-[#1A1F38] border border-[#272D50] rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Apna sawal ya masla likhein..."
                className="w-full bg-[#1A1F38] border border-[#272D50] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!ticketSubject.trim() || !ticketMessage.trim() || ticketSubmitting}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{ticketSubmitting ? 'Sending...' : 'Submit Ticket'}</span>
                </button>
              </div>
            </form>

            {myTickets.length > 0 && (
              <div className="pt-3 border-t border-[#222846] space-y-2">
                <div className="text-[11px] font-semibold text-gray-400">Your Recent Tickets</div>
                {myTickets.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg bg-[#101324] border border-[#222846] flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">{t.subject}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${
                          t.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : t.status === 'in_progress'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-purple-500/15 text-purple-300'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    {t.adminReply && (
                      <p className="text-[11px] text-emerald-300">Admin Reply: {t.adminReply}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cross-Platform Mobile & PC Install Modal */}
      {showInstallModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#111426] border border-[#222846] p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/assets/offnex_icon_square.png"
                  alt="Offnex Ai"
                  className="w-11 h-11 rounded-xl border border-purple-500/30 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Install Offnex Ai</h3>
                  <p className="text-xs text-gray-400">Apna device select karein aur install karein</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close install guide"
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A1F38] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isEmbedded && (
              <div className="mb-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 leading-relaxed">
                Preview mode detected. Direct install ke liye neeche button dabakar live browser tab mein kholein.
              </div>
            )}

            {/* Selectable Platform Cards */}
            <div className="space-y-2.5 text-xs">
              {/* Desktop / PC */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPlatform('desktop');
                  setInstallFeedback(null);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedPlatform === 'desktop'
                    ? 'bg-purple-600/15 border-purple-500 ring-1 ring-purple-500/40'
                    : 'bg-[#14182D] border-[#222846] hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Monitor className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>PC / Laptop (Windows / Mac)</span>
                    {platform === 'desktop' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        Detected
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedPlatform === 'desktop'
                        ? 'border-purple-500 bg-purple-600'
                        : 'border-gray-500'
                    }`}
                  >
                    {selectedPlatform === 'desktop' && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Chrome ya Edge par desktop app ki tarah install karein (address bar Install icon ya ⋮ menu).
                </p>
              </button>

              {/* Android */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPlatform('android');
                  setInstallFeedback(null);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedPlatform === 'android'
                    ? 'bg-purple-600/15 border-purple-500 ring-1 ring-purple-500/40'
                    : 'bg-[#14182D] border-[#222846] hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Android Mobile (Chrome)</span>
                    {platform === 'android' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Detected
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedPlatform === 'android'
                        ? 'border-purple-500 bg-purple-600'
                        : 'border-gray-500'
                    }`}
                  >
                    {selectedPlatform === 'android' && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Android home screen aur app drawer mein direct install karein (⋮ → Add to Home screen).
                </p>
              </button>

              {/* iPhone / iPad */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPlatform('ios');
                  setInstallFeedback(null);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedPlatform === 'ios'
                    ? 'bg-purple-600/15 border-purple-500 ring-1 ring-purple-500/40'
                    : 'bg-[#14182D] border-[#222846] hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Share2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>iPhone / iPad (Safari)</span>
                    {platform === 'ios' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        Detected
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedPlatform === 'ios'
                        ? 'border-purple-500 bg-purple-600'
                        : 'border-gray-500'
                    }`}
                  >
                    {selectedPlatform === 'ios' && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Safari Share button (□↑) → scroll kar ke Add to Home Screen → Add par tap karein.
                </p>
              </button>
            </div>

            {installFeedback && (
              <div className="mt-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-gray-300 leading-relaxed">
                {installFeedback}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {isEmbedded ? (
                <a
                  href={directInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial min-h-[38px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">
                    {selectedPlatform === 'desktop'
                      ? 'Open & Install on PC'
                      : selectedPlatform === 'android'
                      ? 'Open & Install on Android'
                      : 'Open & Install on iPhone'}
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleModalPlatformInstall}
                  className="flex-1 sm:flex-initial min-h-[38px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">
                    {selectedPlatform === 'desktop'
                      ? 'Install for PC'
                      : selectedPlatform === 'android'
                      ? 'Install for Android'
                      : 'How to Install on iPhone'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-[#1A1F38] hover:bg-[#252C52] border border-[#272D50] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
