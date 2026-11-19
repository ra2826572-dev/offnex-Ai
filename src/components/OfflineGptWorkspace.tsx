'use client';

import React, { useState, useEffect } from 'react';
import {
  NavigationTab,
  SupportedLanguage,
  Conversation,
  Message,
  StoredDocument,
  KnowledgeNote,
  KnowledgeFolder,
  AppSettings,
  LocalAIModel,
  UserProfile,
  GeneratedImageRecord,
} from '../types';
import { db } from '../services/db';
import { aiEngine, SUPPORTED_LOCAL_MODELS } from '../services/aiEngine';
import { documentProcessor } from '../services/documentProcessor';
import { authService } from '../services/authService';
import {
  generateImageApi,
  getDailyImageQuota,
  recordDailyImageUsage,
  DAILY_IMAGE_LIMIT,
} from '../services/imageService';

import { DesktopHeader } from './DesktopHeader';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { HomeView } from './HomeView';
import { ChatView, ImageGenerationSubmitPayload } from './ChatView';
import { ImagesView } from './ImagesView';
import { VoiceView } from './VoiceView';
import { SettingsView } from './SettingsView';
import { ModelManagerModal } from './ModelManagerModal';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileDrawer } from './MobileDrawer';
import { AuthPage } from './auth/AuthPage';
import { Menu, WifiOff, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { initPWAListeners } from '../hooks/usePWAInstall';

export function OfflineGptWorkspace() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [language, setLanguage] = useState<SupportedLanguage>('ur');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    language: 'ur',
    theme: 'dark',
    defaultModel: 'gemini-4-hydrogen',
    ollamaHost: 'http://localhost:11434',
    temperature: 0.7,
    contextWindow: 4096,
    speechSpeed: 1.0,
    ttsVoice: 'default',
    offlineStrict: true,
    autoSaveHistory: true,
    enableSoundEffects: true,
  });

  const [models, setModels] = useState<LocalAIModel[]>(SUPPORTED_LOCAL_MODELS);
  const [activeModel, setActiveModel] = useState<string>('gemini-4-hydrogen');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [lastImageError, setLastImageError] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<GeneratedImageRecord[]>([]);
  const [isOllamaConnected, setIsOllamaConnected] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [imageRetryCooldownUntil, setImageRetryCooldownUntil] = useState<number>(0);
  const [autoOpenInstall, setAutoOpenInstall] = useState(false);
  const [dailyUsageTick, setDailyUsageTick] = useState(0);
  const [welcomeBannerName, setWelcomeBannerName] = useState<string | null>(null);

  // Auto-dismiss welcome message after 6 seconds
  useEffect(() => {
    if (!welcomeBannerName) return;
    const timer = setTimeout(() => {
      setWelcomeBannerName(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [welcomeBannerName]);

  // Sync HTML data-theme attribute whenever theme changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = settings.theme;
      try {
        localStorage.setItem('offnex_theme', settings.theme);
      } catch {
        // Ignore storage errors
      }
    }
  }, [settings.theme]);

  // Initialize Database, Auth, PWA listeners and sync state on client mount
  useEffect(() => {
    initPWAListeners();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('install') === '1') {
        setActiveTab('settings');
        setAutoOpenInstall(true);
      }
    }

    async function loadData() {
      authService.initSync();
      const immediateUser = authService.getCurrentUser();
      if (immediateUser) {
        setCurrentUser(immediateUser);
      }
      setIsHydrated(true);

      await authService.init();
      const syncedUser = authService.getCurrentUser();
      if (syncedUser) {
        setCurrentUser(syncedUser);
      }

      await db.init();
      const loadedSettings = await db.getSettings();
      setSettings(loadedSettings);
      setLanguage(loadedSettings.language);

      const convs = await db.getConversations();
      setConversations(convs);
      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
        const msgs = await db.getMessages(convs[0].id);
        setMessages(msgs);
      }

      const docs = await db.getDocuments();
      setDocuments(docs);

      const nts = await db.getNotes();
      setNotes(nts);

      const flds = await db.getFolders();
      setFolders(flds);

      const status = await aiEngine.checkOllamaStatus();
      setIsOllamaConnected(status.connected);

      if (syncedUser?.id) {
        const imgs = await db.getImageHistory(syncedUser.id);
        setImageHistory(imgs);
      }
    }

    loadData();
  }, []);

  // Keep user-scoped image history synced on auth change
  useEffect(() => {
    if (!currentUser?.id) {
      setImageHistory([]);
      return;
    }
    db.init().then(() => db.getImageHistory(currentUser.id)).then(setImageHistory);
  }, [currentUser?.id]);

  // Sync conversation selection
  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    const msgs = await db.getMessages(id);
    setMessages(msgs);
  };

  const handleNewConversation = async () => {
    const newConvId = 'conv-' + Date.now();
    const newConv: Conversation = {
      id: newConvId,
      title: 'New Offline Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelName: activeModel,
      language: language,
      messagesCount: 0,
    };
    await db.saveConversation(newConv);
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConvId);
    setMessages([]);
    setActiveTab('chat');
  };

  const handleDeleteConversation = async (id: string) => {
    await db.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        handleSelectConversation(remaining[0].id);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    }
  };

  // Main message sending handler with real local inference & streaming
  const handleSendMessage = async (text: string, attachedChunks?: any[]) => {
    if (!text.trim() || isGenerating) return;

    let convId = activeConversationId;
    let createdConv: Conversation | null = null;
    if (!convId) {
      convId = 'conv-' + Date.now();
      createdConv = {
        id: convId,
        title: text.slice(0, 32),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        modelName: activeModel,
        language: language,
        messagesCount: 1,
      };
      await db.saveConversation(createdConv);
      setConversations((prev) => [createdConv!, ...prev]);
      setActiveConversationId(convId);
    }

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      conversationId: convId,
      role: 'user',
      content: text,
      timestamp: timeString,
      modelUsed: activeModel,
    };

    setMessages((prev) => [...prev, userMsg]);
    await db.saveMessage(userMsg);

    setIsGenerating(true);

    try {
      const assistantMsgId = 'msg-' + (Date.now() + 1);
      let streamedContent = '';

      const response = await aiEngine.generateResponse(
        text,
        {
          language,
          documentChunks: attachedChunks,
          temperature: settings.temperature,
          history: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        },
        (token) => {
          streamedContent += token;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === assistantMsgId) {
              return [...prev.slice(0, -1), { ...last, content: streamedContent }];
            } else {
              return [
                ...prev,
                {
                  id: assistantMsgId,
                  conversationId: convId!,
                  role: 'assistant',
                  content: streamedContent,
                  timestamp: timeString,
                  modelUsed: activeModel,
                },
              ];
            }
          });
        }
      );

      const finalAssistantMsg: Message = {
        id: assistantMsgId,
        conversationId: convId,
        role: 'assistant',
        content: response.text,
        timestamp: timeString,
        modelUsed: activeModel,
        sources: response.sources,
        suggestedActions: response.suggestedActions || ['Summary', 'More Details'],
      };

      setMessages((prev) => {
        const withoutPartial = prev.filter((m) => m.id !== assistantMsgId);
        return [...withoutPartial, finalAssistantMsg];
      });

      await db.saveMessage(finalAssistantMsg);

      const currentConv = createdConv || conversations.find((c) => c.id === convId);
      if (currentConv) {
        const updated = {
          ...currentConv,
          title: currentConv.title === 'New Offline Chat' ? text.slice(0, 32) : currentConv.title,
          updatedAt: new Date().toISOString(),
          messagesCount: (currentConv.messagesCount || 0) + (createdConv ? 1 : 2),
        };
        await db.saveConversation(updated);
        setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // AI Image Generation handler
  const handleGenerateImage = async (
    payload: ImageGenerationSubmitPayload,
    addToChat: boolean = true
  ) => {
    if (!payload.prompt.trim() || isGeneratingImage) return;

    const now = Date.now();
    if (now < imageRetryCooldownUntil) {
      const waitSec = Math.ceil((imageRetryCooldownUntil - now) / 1000);
      setLastImageError(
        `Image generation quota exceeded. Please try again in ${waitSec}s or check your Google AI billing and quota.`
      );
      return;
    }

    const uid = currentUser?.id || 'anonymous';
    const currentDailyQuota = getDailyImageQuota(uid, imageHistory, DAILY_IMAGE_LIMIT);
    if (currentDailyQuota.remaining <= 0) {
      setLastImageError(
        `Daily image limit reached (${currentDailyQuota.limit}/${currentDailyQuota.limit} images used today). Free chat is unlimited — you can create more images tomorrow.`
      );
      return;
    }
    if (payload.count > currentDailyQuota.remaining) {
      setLastImageError(
        `Only ${currentDailyQuota.remaining} image(s) left in today's ${currentDailyQuota.limit}-image daily limit. Please set image count to ${currentDailyQuota.remaining} or less.`
      );
      return;
    }

    setLastImageError(null);
    let convId = activeConversationId;
    let newlyCreatedConv: Conversation | null = null;

    if (addToChat) {
      if (!convId) {
        convId = 'conv-' + Date.now();
        newlyCreatedConv = {
          id: convId,
          title: `Image: ${payload.prompt.slice(0, 26)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          modelName: payload.provider === 'local' ? 'Local Stable Diffusion' : 'Gemini Image',
          language: language,
          messagesCount: 1,
        };
        await db.saveConversation(newlyCreatedConv);
        setConversations((prev) => [newlyCreatedConv!, ...prev]);
        setActiveConversationId(convId);
      }

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userMsg: Message = {
        id: 'msg-' + Date.now(),
        conversationId: convId,
        role: 'user',
        content: `Generate image: ${payload.prompt}`,
        timestamp: timeString,
        modelUsed: payload.provider === 'local' ? 'Local SD' : 'Gemini Image',
        imageGeneration: payload.referenceImage
          ? {
              prompt: payload.prompt,
              style: payload.style,
              aspectRatio: payload.aspectRatio,
              quality: payload.quality,
              count: payload.count,
              provider: payload.provider,
              images: [],
              referencePreviewUrl: payload.referenceImage.previewUrl,
            }
          : undefined,
      };

      setMessages((prev) => [...prev, userMsg]);
      await db.saveMessage(userMsg);
    }

    setIsGeneratingImage(true);

    try {
      const result = await generateImageApi({
        prompt: payload.prompt,
        style: payload.style,
        aspectRatio: payload.aspectRatio,
        quality: payload.quality,
        count: payload.count,
        provider: payload.provider,
        referenceImage: payload.referenceImage
          ? { data: payload.referenceImage.data, mimeType: payload.referenceImage.mimeType }
          : undefined,
        userId: uid,
        offlineStrict: settings.offlineStrict,
      });

      if (addToChat && convId) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assistantMsg: Message = {
          id: 'msg-' + (Date.now() + 1),
          conversationId: convId,
          role: 'assistant',
          content: result.textNote || '',
          timestamp: timeString,
          modelUsed: result.modelUsed,
          imageGeneration: {
            prompt: payload.prompt,
            style: payload.style,
            aspectRatio: payload.aspectRatio,
            quality: payload.quality,
            count: result.images.length,
            provider: result.provider,
            images: result.images,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        await db.saveMessage(assistantMsg);

        const targetConv = newlyCreatedConv || conversations.find((c) => c.id === convId);
        if (targetConv) {
          const updated: Conversation = {
            ...targetConv,
            title:
              targetConv.title === 'New Offline Chat'
                ? `Image: ${payload.prompt.slice(0, 26)}`
                : targetConv.title,
            updatedAt: new Date().toISOString(),
            messagesCount: (targetConv.messagesCount || 0) + (newlyCreatedConv ? 1 : 2),
          };
          await db.saveConversation(updated);
          setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
        }
      }

      const historyRecord: GeneratedImageRecord = {
        id: 'imgrec-' + Date.now(),
        userId: uid,
        conversationId: addToChat ? convId || undefined : undefined,
        prompt: payload.prompt,
        style: payload.style,
        aspectRatio: payload.aspectRatio,
        quality: payload.quality,
        count: result.images.length,
        modelUsed: result.modelUsed,
        provider: result.provider,
        images: result.images,
        hasReferenceImage: Boolean(payload.referenceImage),
        createdAt: new Date().toISOString(),
      };
      await db.saveImageRecord(historyRecord);
      setImageHistory((prev) => [historyRecord, ...prev]);
      recordDailyImageUsage(uid, result.images.length);
      setDailyUsageTick((t) => t + 1);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      const rawMsg = errObj?.message || 'Image generation failed.';
      const lower = rawMsg.toLowerCase();
      const isDailyLimitError =
        lower.includes('daily') || lower.includes('per day') || lower.includes('10 images');
      const isQuotaError =
        !isDailyLimitError && (lower.includes('quota') || lower.includes('429'));

      const errorMsg = isQuotaError
        ? 'Image generation quota exceeded. Please try again later or check your Google AI billing and quota.'
        : rawMsg;

      if (isQuotaError) {
        setImageRetryCooldownUntil(Date.now() + 30000);
      }

      setLastImageError(errorMsg);
      if (addToChat && convId) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const errAssistantMsg: Message = {
          id: 'msg-' + (Date.now() + 1),
          conversationId: convId,
          role: 'assistant',
          content: '',
          timestamp: timeString,
          modelUsed: payload.provider === 'local' ? 'Local SD' : 'Gemini Image',
          imageGeneration: {
            prompt: payload.prompt,
            style: payload.style,
            aspectRatio: payload.aspectRatio,
            quality: payload.quality,
            count: payload.count,
            provider: payload.provider,
            images: [],
            error: errorMsg,
          },
        };
        setMessages((prev) => [...prev, errAssistantMsg]);
        await db.saveMessage(errAssistantMsg);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDeleteImageHistory = async (id: string) => {
    const uid = currentUser?.id || 'anonymous';
    await db.deleteImageRecord(id, uid);
    setImageHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // File Upload & Chat Analysis
  const handleUploadFile = async (file: File) => {
    const doc = await documentProcessor.processFile(file);
    await db.saveDocument(doc);
    setDocuments((prev) => [doc, ...prev]);
    setActiveTab('chat');
    handleSendMessage(
      `Please analyze and summarize this uploaded file (${doc.name}):\n\n${doc.content.slice(0, 3000)}`
    );
  };

  // Quick Tools Click Dispatcher
  const handleQuickToolClick = (toolName: string) => {
    if (toolName === 'translator') {
      setActiveTab('chat');
      handleSendMessage('Urdu aur English ke darmiyan common professional phrases translate karo.');
    } else if (toolName === 'summarizer' || toolName === 'pdf-reader') {
      setActiveTab('chat');
      handleSendMessage('Help me summarize a text or document.');
    } else if (toolName === 'study-helper' || toolName === 'ai-tutor') {
      setActiveTab('chat');
      handleSendMessage('Act as my personal AI tutor and help me learn a topic step by step.');
    }
  };

  // Voice Query Dispatcher
  const handleVoiceQuery = async (queryText: string): Promise<string> => {
    const res = await aiEngine.generateResponse(queryText, { language });
    return res.text;
  };

  // Language update
  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    const updated = { ...settings, language: newLang };
    setSettings(updated);
    await db.saveSettings(updated);
  };

  // Switch Offline Mode off when user explicitly requests online cloud features
  const handleDisableOfflineMode = async () => {
    const updated = { ...settings, offlineStrict: false };
    setSettings(updated);
    await db.saveSettings(updated);
    setLastImageError(null);
  };

  // Model selection
  const handleSelectModel = (modelTag: string) => {
    setActiveModel(modelTag);
    aiEngine.setActiveModel(modelTag);
  };

  // Calculate total storage usage in MB
  const totalStorageMb =
    Math.round(
      (documents.reduce((acc, d) => acc + d.size, 0) / (1024 * 1024) +
        messages.length * 0.002 +
        notes.length * 0.005) *
        10
    ) /
      10 +
    3.8;

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveTab('home');
  };

  const activeModelObj = models.find((m) => m.id === activeModel) || models[0];
  void dailyUsageTick;
  const dailyImageQuota = getDailyImageQuota(currentUser?.id, imageHistory, DAILY_IMAGE_LIMIT);

  // Prevent SSR/client hydration mismatch while reading localStorage auth state
  if (!isHydrated) {
    return (
      <div className="h-[100dvh] w-full bg-[#0B0D18] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#7547FF]/40 bg-[#07091A] shadow-xl shadow-[#7547FF]/25">
          <img src="/assets/offnex_icon_square.png" alt="Offnex Ai" className="w-full h-full object-cover" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-extrabold text-white tracking-tight">
            Offnex <span className="text-[#8C62FF]">Ai</span>
          </p>
          <p className="text-xs text-slate-400">Initializing your workspace...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render AuthPage
  if (!currentUser) {
    return (
      <AuthPage
        onAuthenticated={() => {
          const authed = authService.getCurrentUser();
          setCurrentUser(authed);
          if (authed) {
            const fullName = [authed.firstName, authed.lastName]
              .filter(Boolean)
              .join(' ')
              .trim();
            setWelcomeBannerName(fullName || authed.email.split('@')[0] || 'User');
          }
        }}
      />
    );
  }

  const isLight = settings.theme === 'light';

  return (
    <div
      className={`flex flex-col h-[100dvh] w-full min-h-0 min-w-0 max-w-full ${
        isLight ? 'bg-white text-slate-900' : 'bg-[#0B0D18] text-gray-100'
      } overflow-hidden font-sans select-none transition-colors duration-300 relative`}
    >
      {/* Post-Sign-In Welcome Greeting ("Hello <Name>") */}
      <AnimatePresence>
        {welcomeBannerName && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md rounded-2xl bg-[#111426] border border-purple-500/45 shadow-2xl shadow-purple-950/50 px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4435D5] to-[#7547FF] flex items-center justify-center shrink-0 shadow-md shadow-purple-600/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white truncate">
                  Hello {welcomeBannerName}!
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  Welcome to Offnex Ai — ready to chat &amp; create.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss welcome message"
              onClick={() => setWelcomeBannerName(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A1F38] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 1. Desktop / Tablet Top Bar */}
      <DesktopHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModelName={activeModelObj.name}
        isOllamaConnected={isOllamaConnected}
        onOpenModelManager={() => setIsModelManagerOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        offlineStrict={settings.offlineStrict}
        theme={settings.theme}
        onToggleTheme={async () => {
          const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
          const updated = { ...settings, theme: nextTheme } as AppSettings;
          setSettings(updated);
          await db.saveSettings(updated);
        }}
      />

      {/* Mobile Top Header */}
      <div className="md:hidden h-12 bg-[#101324] border-b border-[#1F243D] px-3 flex items-center justify-between z-30 shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-cyan-500/30 bg-[#07091A] shrink-0">
            <img src="/assets/offnex_icon_square.png" alt="Offnex Ai" className="w-full h-full object-cover" />
          </div>
          <span className="font-extrabold text-white text-sm whitespace-nowrap">
            <span>Offnex</span> <span className="text-[#287BFF]">Ai</span>
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 text-[10px] font-medium ${
            settings.offlineStrict
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
          } px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap`}
        >
          <WifiOff className="w-3 h-3 shrink-0" />
          <span>{settings.offlineStrict ? 'Offline' : 'Online'}</span>
        </div>
      </div>

      {/* 2. Main Three-Column Workspace */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Left Sidebar (Desktop only) */}
        <div className="hidden md:block h-full shrink-0">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            language={language}
            setLanguage={handleLanguageChange}
            onOpenProfile={() => setActiveTab('settings')}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </div>

        {/* Center Workspace View Switcher */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden ${isLight ? 'bg-white' : 'bg-[#0B0D18]'} relative min-w-0`}>
          {activeTab === 'home' && (
            <HomeView
              conversations={conversations}
              documents={documents}
              activeModelObj={activeModelObj}
              models={models}
              totalStorageMb={totalStorageMb}
              isOllamaConnected={isOllamaConnected}
              onNewConversation={handleNewConversation}
              onSelectConversation={handleSelectConversation}
              onSelectDocument={() => setActiveTab('chat')}
              onUploadClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.txt,.md,.json,.docx';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleUploadFile(file);
                };
                input.click();
              }}
              onOpenModelManager={() => setIsModelManagerOpen(true)}
              setActiveTab={setActiveTab}
              language={language}
              userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Rizwan Ahmad'}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              isGenerating={isGenerating}
              isGeneratingImage={isGeneratingImage}
              onGenerateImage={handleGenerateImage}
              imageHistory={imageHistory}
              onDeleteImageHistory={handleDeleteImageHistory}
              activeModel={activeModel}
              onSelectModel={handleSelectModel}
              supportedModels={models}
              onVoiceClick={() => setActiveTab('voice')}
              onUploadClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.txt,.md,.json,.docx';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleUploadFile(file);
                };
                input.click();
              }}
              language={language}
              offlineStrict={settings.offlineStrict}
              onDisableOfflineMode={handleDisableOfflineMode}
              userId={currentUser?.id}
            />
          )}

          {activeTab === 'images' && (
            <ImagesView
              imageHistory={imageHistory}
              isGeneratingImage={isGeneratingImage}
              lastImageError={lastImageError}
              onClearError={() => setLastImageError(null)}
              onGenerateImage={handleGenerateImage}
              onDeleteImageHistory={handleDeleteImageHistory}
              offlineStrict={settings.offlineStrict}
              onDisableOfflineMode={handleDisableOfflineMode}
              userId={currentUser?.id}
              dailyQuota={dailyImageQuota}
            />
          )}

          {activeTab === 'voice' && (
            <VoiceView
              language={language}
              setLanguage={handleLanguageChange}
              onSendVoiceQuery={handleVoiceQuery}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={async (s) => {
                setSettings(s);
                await db.saveSettings(s);
              }}
              onOpenModelManager={() => setIsModelManagerOpen(true)}
              language={language}
              setLanguage={handleLanguageChange}
              currentUser={currentUser}
              onLogout={handleLogout}
              initialOpenInstall={autoOpenInstall}
              onClearAutoOpenInstall={() => setAutoOpenInstall(false)}
            />
          )}
        </main>

        {/* Right Sidebar (Quick Tools, Did You Know, Storage) */}
        {activeTab !== 'chat' && activeTab !== 'images' && (
          <div className="hidden xl:block h-full shrink-0">
            <RightSidebar
              setActiveTab={setActiveTab}
              onQuickToolClick={handleQuickToolClick}
              storageUsageMb={totalStorageMb}
              totalDocsCount={documents.length}
            />
          </div>
        )}
      </div>

      {/* 3. Mobile Navigation Bottom Bar */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 4. Mobile Drawer Menu */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        language={language}
        setLanguage={handleLanguageChange}
      />

      {/* 5. Local AI Model Manager Modal */}
      <ModelManagerModal
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
        activeModel={activeModel}
        onSelectModel={handleSelectModel}
        models={models}
        onUpdateModels={setModels}
      />
    </div>
  );
}
