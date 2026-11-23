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
  ImageStyle,
  ImageAspectRatio,
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
import { generatePlayableVideo } from '../services/offlineVideoEngine';
import {
  deleteConversationOnBackend,
  deleteImageRecordOnBackend,
  fetchUserChatsFromBackend,
  fetchUserImagesFromBackend,
  syncConversationToBackend,
  syncDocumentToBackend,
  syncImageRecordToBackend,
  syncSettingsToBackend,
} from '../services/backendSync';

import { DesktopHeader } from './DesktopHeader';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { HomeView } from './HomeView';
import { ChatView, ImageGenerationSubmitPayload, VideoGenerationSubmitPayload } from './ChatView';
import { ImagesView } from './ImagesView';
import { VoiceView } from './VoiceView';
import { SettingsView } from './SettingsView';
import { ModelManagerModal } from './ModelManagerModal';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileDrawer } from './MobileDrawer';
import { AuthPage } from './auth/AuthPage';
import { Menu, Wifi, WifiOff, Sparkles, X } from 'lucide-react';
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
    defaultModel: 'gemini-3.1-flash-lite',
    ollamaHost: 'http://localhost:11434',
    temperature: 0.7,
    contextWindow: 4096,
    speechSpeed: 1.0,
    ttsVoice: 'default',
    offlineStrict: false,
    autoSaveHistory: true,
    enableSoundEffects: true,
  });

  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [models, setModels] = useState<LocalAIModel[]>(SUPPORTED_LOCAL_MODELS);
  const [activeModel, setActiveModel] = useState<string>('gemini-3.1-flash-lite');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [lastImageError, setLastImageError] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<GeneratedImageRecord[]>([]);
  const [isOllamaConnected, setIsOllamaConnected] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [imageRetryCooldownUntil, setImageRetryCooldownUntil] = useState<number>(0);
  const [autoOpenInstall, setAutoOpenInstall] = useState(false);
  const [dailyUsageTick, setDailyUsageTick] = useState(0);
  const [welcomeBannerName, setWelcomeBannerName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsNetworkOnline(navigator.onLine);
    const onOnline = () => setIsNetworkOnline(true);
    const onOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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

      const allLocalConvs = await db.getConversations();
      const uid = syncedUser?.id;
      const scopedLocalConvs = uid
        ? allLocalConvs.filter((c) => !c.userId || c.userId === uid)
        : allLocalConvs;

      let mergedConvs = scopedLocalConvs;
      if (uid) {
        const backendChats = await fetchUserChatsFromBackend(uid);
        if (backendChats) {
          const convMap = new Map<string, Conversation>();
          for (const c of scopedLocalConvs) convMap.set(c.id, c);
          for (const c of backendChats.conversations) {
            const existing = convMap.get(c.id);
            if (!existing || new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
              convMap.set(c.id, c);
              await db.saveConversation(c);
            }
          }
          for (const m of backendChats.messages) {
            await db.saveMessage(m);
          }
          // Push any local-only chats to backend
          const backendIds = new Set(backendChats.conversations.map((c) => c.id));
          for (const localConv of scopedLocalConvs) {
            if (!backendIds.has(localConv.id)) {
              const localMsgs = await db.getMessages(localConv.id);
              const taggedConv: Conversation = {
                ...localConv,
                userId: localConv.userId || uid,
                userEmail: localConv.userEmail || syncedUser?.email,
              };
              await db.saveConversation(taggedConv);
              void syncConversationToBackend(
                taggedConv,
                localMsgs.map((m) => ({ ...m, userId: m.userId || uid }))
              );
            }
          }
          mergedConvs = Array.from(convMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
      }

      setConversations(mergedConvs);
      if (mergedConvs.length > 0) {
        setActiveConversationId(mergedConvs[0].id);
        const msgs = await db.getMessages(mergedConvs[0].id);
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
        const localImgs = await db.getImageHistory(syncedUser.id);
        const backendImgs = await fetchUserImagesFromBackend(syncedUser.id);
        if (backendImgs) {
          const imgMap = new Map<string, GeneratedImageRecord>();
          for (const rec of localImgs) imgMap.set(rec.id, rec);
          for (const rec of backendImgs) {
            if (!imgMap.has(rec.id)) {
              imgMap.set(rec.id, rec);
              await db.saveImageRecord(rec);
            }
          }
          const backendImgIds = new Set(backendImgs.map((r) => r.id));
          for (const rec of localImgs) {
            if (!backendImgIds.has(rec.id)) {
              void syncImageRecordToBackend({
                ...rec,
                userEmail: rec.userEmail || syncedUser.email,
                userName:
                  rec.userName ||
                  [syncedUser.firstName, syncedUser.lastName].filter(Boolean).join(' ').trim(),
              });
            }
          }
          const mergedImgs = Array.from(imgMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setImageHistory(mergedImgs);
        } else {
          setImageHistory(localImgs);
        }
      }
    }

    loadData();
  }, []);

  // Keep user-scoped chats and image history synced on auth change
  useEffect(() => {
    if (!currentUser?.id) {
      setImageHistory([]);
      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
      return;
    }
    const uid = currentUser.id;
    db.init().then(async () => {
      const localImgs = await db.getImageHistory(uid);
      const backendImgs = await fetchUserImagesFromBackend(uid);
      if (backendImgs) {
        const map = new Map<string, GeneratedImageRecord>();
        for (const r of localImgs) map.set(r.id, r);
        for (const r of backendImgs) {
          if (!map.has(r.id)) {
            map.set(r.id, r);
            await db.saveImageRecord(r);
          }
        }
        setImageHistory(
          Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      } else {
        setImageHistory(localImgs);
      }

      const localConvs = (await db.getConversations()).filter(
        (c) => !c.userId || c.userId === uid
      );
      const backendChats = await fetchUserChatsFromBackend(uid);
      if (backendChats) {
        const cMap = new Map<string, Conversation>();
        for (const c of localConvs) cMap.set(c.id, c);
        for (const c of backendChats.conversations) {
          cMap.set(c.id, c);
          await db.saveConversation(c);
        }
        for (const m of backendChats.messages) {
          await db.saveMessage(m);
        }
        const merged = Array.from(cMap.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setConversations(merged);
        if (merged.length > 0) {
          setActiveConversationId(merged[0].id);
          setMessages(await db.getMessages(merged[0].id));
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      } else {
        setConversations(localConvs);
      }
    });
  }, [currentUser?.id]);

  // Sync conversation selection
  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    const msgs = await db.getMessages(id);
    setMessages(msgs);
  };

  const handleNewConversation = async () => {
    const newConvId = 'conv-' + Date.now();
    const userName = currentUser
      ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim()
      : undefined;
    const newConv: Conversation = {
      id: newConvId,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userName,
      title: 'New Offline Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelName: activeModel,
      language: language,
      messagesCount: 0,
    };
    await db.saveConversation(newConv);
    void syncConversationToBackend(newConv);
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConvId);
    setMessages([]);
    setActiveTab('chat');
  };

  const handleDeleteConversation = async (id: string) => {
    await db.deleteConversation(id);
    void deleteConversationOnBackend(id);
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

  // Detect when user asks for an image/photo/logo/tasveer in Chat and route to Pinterest-first Image Studio
  const extractChatImageRequest = (
    rawText: string
  ): { prompt: string; style: ImageStyle } | null => {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // 1. Direct Pinterest Pin / Board link
    if (/^https?:\/\/(www\.)?(pinterest\.com|pin\.it)\//i.test(trimmed)) {
      return { prompt: trimmed, style: 'Realistic Photography' };
    }

    const low = trimmed.toLowerCase();

    // Exclude technical / coding / informational questions about image concepts
    const isInformationalQuestion =
      /\b(what is|how does|how to compress|how to resize|difference between|explain|html|css|img tag|base64|svg|format|ocr|extract text|pdf|summarize)\b/i.test(
        low
      ) && !/\b(generate|create|draw|show me|give me|banao|dikhao|chahiye)\b/i.test(low);
    if (isInformationalQuestion) return null;

    const hasImageNoun =
      /\b(image|images|picture|pictures|pic|pics|photo|photos|wallpaper|wallpapers|logo|logos|poster|posters|sketch|drawing|painting|portrait|avatar|tasveer|tasweer|tasvir|dp)\b|تصویر/i.test(
        low
      );

    const hasRequestVerb =
      /\b(generate|create|make|draw|paint|sketch|design|render|show|give|find|search|send|get|fetch|need|want|banao|bana|bna|dikhao|dikha|do|dein|de|chahiye|chaye|bhejo|nikal|lao)\b|بناؤ|بنا|دکھاؤ|دکھا|تصویر/i.test(
        low
      );

    const startsWithVisualCommand =
      /^(draw|sketch|paint|imagine|wallpaper|logo|image of|picture of|photo of|pic of|tasveer)\b/i.test(
        low
      );

    if (!((hasImageNoun && hasRequestVerb) || startsWithVisualCommand)) {
      return null;
    }

    let inferredStyle: ImageStyle = 'Realistic Photography';
    if (/\blogo\b/i.test(low)) inferredStyle = 'Logo Design';
    else if (/\banime\b/i.test(low)) inferredStyle = 'Anime';
    else if (/\b3d\b/i.test(low)) inferredStyle = '3D Rendering';
    else if (/\b(sketch|drawing|illustration)\b/i.test(low)) inferredStyle = 'Illustration';
    else if (/\b(wallpaper|digital art|concept art|painting)\b/i.test(low)) inferredStyle = 'Digital Art';
    else if (/\bcinematic\b/i.test(low)) inferredStyle = 'Cinematic';

    const cleanedPrompt = trimmed
      .replace(
        /^(please|can you|could you|mujhe|mujh ko|mere liye|zara|ek|ai)\s+/gi,
        ''
      )
      .replace(
        /\b(generate|create|make|draw|show me|give me|find me|send me|search)\s+(an?\s+)?(image|picture|pic|photo|wallpaper|tasveer|tasweer)\s+(of|for|about)?\s*/gi,
        ''
      )
      .replace(/\b(ki|ka|ke)\s+(image|picture|pic|photo|wallpaper|tasveer|tasweer|tasvir)\s*(banao|bana do|dikhao|dikha do|do|dein|chahiye|chaye|bhejo)?/gi, '')
      .replace(/\b(banao|bana do|dikhao|dikha do|chahiye|chaye)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      prompt: cleanedPrompt.length >= 2 ? cleanedPrompt : trimmed,
      style: inferredStyle,
    };
  };

  // Detect when user asks to create/generate a video in Chat (works both Online & Offline)
  const extractChatVideoRequest = (
    rawText: string
  ): { prompt: string; style: ImageStyle; aspectRatio: ImageAspectRatio } | null => {
    const trimmed = rawText.trim();
    if (!trimmed) return null;
    const low = trimmed.toLowerCase();

    // Exclude video script/tutorial/editing requests so they route to AI Chat (Online & Offline)
    if (
      /\b(script|storyboard|outline|editing|caption|hashtags|tutorial|guide|tips|software|explain|what is|how does|how to)\b/i.test(
        low
      )
    ) {
      return null;
    }

    const hasVideoNoun =
      /\b(video|videos|reel|reels|clip|clips|animation|short video|shorts)\b|ویڈیو/i.test(low);
    const hasActionVerb =
      /\b(generate|create|make|render|animate|show|give|banao|bana|bna|dikhao|dikha|do|dein|de|chahiye|chaye)\b|بناؤ|بنا|دکھاؤ/i.test(
        low
      );
    const startsWithVideoCommand =
      /^(animate|video of|reel of|clip of|make video|create video|generate video)\b/i.test(low);

    if (!((hasVideoNoun && hasActionVerb) || startsWithVideoCommand)) {
      return null;
    }

    let inferredStyle: ImageStyle = 'Cinematic';
    if (/\banime\b/i.test(low)) inferredStyle = 'Anime';
    else if (/\b3d\b/i.test(low)) inferredStyle = '3D Rendering';
    else if (/\b(digital art|painting|fantasy)\b/i.test(low)) inferredStyle = 'Digital Art';
    else if (/\b(real|realistic|nature|mountain|sunset|city|rain|snow)\b/i.test(low)) {
      inferredStyle = 'Realistic Photography';
    }

    let inferredRatio: ImageAspectRatio = '16:9';
    if (/\b(9:16|reel|reels|tiktok|shorts|vertical|portrait)\b/i.test(low)) {
      inferredRatio = '9:16';
    } else if (/\b(1:1|square)\b/i.test(low)) {
      inferredRatio = '1:1';
    } else if (/\b(4:3)\b/i.test(low)) {
      inferredRatio = '4:3';
    }

    const cleanedPrompt = trimmed
      .replace(/^(please|can you|could you|mujhe|mujh ko|mere liye|zara|ek|ai)\s+/gi, '')
      .replace(
        /\b(generate|create|make|render|animate|show me|give me)\s+(an?\s+)?(video|reel|clip|animation|short video)\s+(of|for|about)?\s*/gi,
        ''
      )
      .replace(
        /\b(ki|ka|ke)\s+(video|reel|clip|animation)\s*(banao|bana do|dikhao|dikha do|do|dein|chahiye|chaye)?/gi,
        ''
      )
      .replace(/\b(banao|bana do|dikhao|dikha do|chahiye|chaye)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      prompt: cleanedPrompt.length >= 2 ? cleanedPrompt : trimmed,
      style: inferredStyle,
      aspectRatio: inferredRatio,
    };
  };

  // Main message sending handler with real local inference & streaming
  const handleSendMessage = async (text: string, attachedChunks?: any[]) => {
    if (!text.trim() || isGenerating) return;

    // Route video creation prompts to Video Studio (works Online & Offline)
    if (!attachedChunks || attachedChunks.length === 0) {
      const chatVideoReq = extractChatVideoRequest(text);
      if (chatVideoReq) {
        await handleGenerateVideo(
          {
            prompt: chatVideoReq.prompt,
            style: chatVideoReq.style,
            aspectRatio: chatVideoReq.aspectRatio,
            quality: 'standard',
            durationSec: 4,
          },
          true,
          text.trim()
        );
        return;
      }

      // If the user is asking for an image in Chat, automatically check Pinterest first and return visual results in Chat
      const chatImageReq = extractChatImageRequest(text);
      if (chatImageReq) {
        await handleGenerateImage(
          {
            prompt: chatImageReq.prompt,
            style: chatImageReq.style,
            aspectRatio: '1:1',
            quality: 'standard',
            count: 1,
            provider: 'gemini',
          },
          true,
          text.trim()
        );
        return;
      }
    }

    const ownerName = currentUser
      ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim()
      : undefined;
    let convId = activeConversationId;
    let createdConv: Conversation | null = null;
    if (!convId) {
      convId = 'conv-' + Date.now();
      createdConv = {
        id: convId,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: ownerName,
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
      userId: currentUser?.id,
      role: 'user',
      content: text,
      timestamp: timeString,
      modelUsed: activeModel,
    };

    setMessages((prev) => [...prev, userMsg]);
    await db.saveMessage(userMsg);
    void syncConversationToBackend(createdConv || undefined, [userMsg]);

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
          offlineStrict: settings.offlineStrict || !isNetworkOnline,
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
        userId: currentUser?.id,
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
        const updated: Conversation = {
          ...currentConv,
          userId: currentConv.userId || currentUser?.id,
          userEmail: currentConv.userEmail || currentUser?.email,
          userName: currentConv.userName || ownerName,
          title: currentConv.title === 'New Offline Chat' ? text.slice(0, 32) : currentConv.title,
          updatedAt: new Date().toISOString(),
          messagesCount: (currentConv.messagesCount || 0) + (createdConv ? 1 : 2),
        };
        await db.saveConversation(updated);
        setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
        void syncConversationToBackend(updated, [userMsg, finalAssistantMsg]);
      } else {
        void syncConversationToBackend(undefined, [finalAssistantMsg]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // AI Image Generation handler
  const handleGenerateImage = async (
    payload: ImageGenerationSubmitPayload,
    addToChat: boolean = true,
    displayUserMessage?: string
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
      const limitMsg = `Daily image limit reached (${currentDailyQuota.limit}/${currentDailyQuota.limit} images used today). Free chat is unlimited — you can create more images tomorrow.`;
      setLastImageError(limitMsg);
      if (addToChat) {
        let convId = activeConversationId;
        if (!convId) {
          convId = 'conv-' + Date.now();
          const conv: Conversation = {
            id: convId,
            title: (displayUserMessage || payload.prompt).slice(0, 28),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            modelName: 'Offnex Image Studio',
            language,
            messagesCount: 2,
          };
          await db.saveConversation(conv);
          setConversations((prev) => [conv, ...prev]);
          setActiveConversationId(convId);
        }
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const uMsg: Message = {
          id: 'msg-' + Date.now(),
          conversationId: convId,
          role: 'user',
          content: displayUserMessage || `Generate image: ${payload.prompt}`,
          timestamp: t,
        };
        const aMsg: Message = {
          id: 'msg-' + (Date.now() + 1),
          conversationId: convId,
          role: 'assistant',
          content: `Aaj ki **${currentDailyQuota.limit} images** ki daily limit poori ho chuki hai. Free text chat unlimited hai — kal dubara ${currentDailyQuota.limit} images bana saktay hain.`,
          timestamp: t,
          modelUsed: 'Offnex Image Studio',
        };
        setMessages((prev) => [...prev, uMsg, aMsg]);
        await db.saveMessage(uMsg);
        await db.saveMessage(aMsg);
      }
      return;
    }
    if (payload.count > currentDailyQuota.remaining) {
      setLastImageError(
        `Only ${currentDailyQuota.remaining} image(s) left in today's ${currentDailyQuota.limit}-image daily limit. Please set image count to ${currentDailyQuota.remaining} or less.`
      );
      return;
    }

    const ownerName = currentUser
      ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim()
      : undefined;
    setLastImageError(null);
    let convId = activeConversationId;
    let newlyCreatedConv: Conversation | null = null;
    let chatUserMsg: Message | null = null;

    if (addToChat) {
      if (!convId) {
        convId = 'conv-' + Date.now();
        newlyCreatedConv = {
          id: convId,
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          userName: ownerName,
          title: (displayUserMessage || `Image: ${payload.prompt}`).slice(0, 28),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          modelName:
            payload.provider === 'local'
              ? 'Local Stable Diffusion'
              : 'Offnex Image Studio',
          language: language,
          messagesCount: 1,
        };
        await db.saveConversation(newlyCreatedConv);
        setConversations((prev) => [newlyCreatedConv!, ...prev]);
        setActiveConversationId(convId);
      }

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      chatUserMsg = {
        id: 'msg-' + Date.now(),
        conversationId: convId,
        userId: currentUser?.id,
        role: 'user',
        content: displayUserMessage || `Generate image: ${payload.prompt}`,
        timestamp: timeString,
        modelUsed:
          payload.provider === 'local'
            ? 'Local SD'
            : 'Offnex Image Studio',
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

      setMessages((prev) => [...prev, chatUserMsg!]);
      await db.saveMessage(chatUserMsg);
      void syncConversationToBackend(newlyCreatedConv || undefined, [chatUserMsg]);
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
        userEmail: currentUser?.email,
        userName: ownerName,
        offlineStrict: settings.offlineStrict,
      });

      if (addToChat && convId) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assistantMsg: Message = {
          id: 'msg-' + (Date.now() + 1),
          conversationId: convId,
          userId: currentUser?.id,
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
            userId: targetConv.userId || currentUser?.id,
            userEmail: targetConv.userEmail || currentUser?.email,
            userName: targetConv.userName || ownerName,
            title:
              targetConv.title === 'New Offline Chat'
                ? `Image: ${payload.prompt.slice(0, 26)}`
                : targetConv.title,
            updatedAt: new Date().toISOString(),
            messagesCount: (targetConv.messagesCount || 0) + (newlyCreatedConv ? 1 : 2),
          };
          await db.saveConversation(updated);
          setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
          void syncConversationToBackend(
            updated,
            chatUserMsg ? [chatUserMsg, assistantMsg] : [assistantMsg]
          );
        } else {
          void syncConversationToBackend(undefined, [assistantMsg]);
        }
      }

      const historyRecord: GeneratedImageRecord = {
        id: result.savedRecordId || 'imgrec-' + Date.now(),
        userId: uid,
        userEmail: currentUser?.email,
        userName: ownerName,
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
      void syncImageRecordToBackend(historyRecord);
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
          modelUsed:
            payload.provider === 'local'
              ? 'Local SD'
              : payload.provider === 'pinterest'
              ? 'Pinterest'
              : 'Gemini Image',
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

  // AI Video Generation handler (works identically in Online Mode & Offline Mode)
  const handleGenerateVideo = async (
    payload: VideoGenerationSubmitPayload,
    addToChat: boolean = true,
    displayUserMessage?: string
  ) => {
    if (!payload.prompt.trim() || isGeneratingVideo) return;

    const uid = currentUser?.id || 'anonymous';
    const ownerName = currentUser
      ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim()
      : undefined;
    const offlineMode = !isNetworkOnline || settings.offlineStrict;

    setLastImageError(null);
    let convId = activeConversationId;
    let newlyCreatedConv: Conversation | null = null;
    let chatUserMsg: Message | null = null;

    if (addToChat) {
      if (!convId) {
        convId = 'conv-' + Date.now();
        newlyCreatedConv = {
          id: convId,
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          userName: ownerName,
          title: (displayUserMessage || `Video: ${payload.prompt}`).slice(0, 28),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          modelName: 'Offnex Video Studio',
          language,
          messagesCount: 1,
        };
        await db.saveConversation(newlyCreatedConv);
        setConversations((prev) => [newlyCreatedConv!, ...prev]);
        setActiveConversationId(convId);
      }

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      chatUserMsg = {
        id: 'msg-' + Date.now(),
        conversationId: convId,
        userId: currentUser?.id,
        role: 'user',
        content: displayUserMessage || `Create video: ${payload.prompt}`,
        timestamp: timeString,
        modelUsed: offlineMode ? 'Offnex Video Studio (Offline)' : 'Offnex Video Studio',
      };
      setMessages((prev) => [...prev, chatUserMsg!]);
      await db.saveMessage(chatUserMsg);
      void syncConversationToBackend(newlyCreatedConv || undefined, [chatUserMsg]);
    }

    setIsGeneratingVideo(true);

    try {
      let baseFrameUrl = payload.baseImageDataUrl;
      if (!baseFrameUrl && !offlineMode) {
        try {
          const frameRes = await generateImageApi({
            prompt: payload.prompt,
            style: payload.style,
            aspectRatio: payload.aspectRatio,
            quality: payload.quality || 'standard',
            count: 1,
            provider: 'gemini',
            userId: uid,
            userEmail: currentUser?.email,
            userName: ownerName,
            offlineStrict: false,
          });
          baseFrameUrl = frameRes.images[0]?.dataUrl;
        } catch {
          // Fallback gracefully to on-device frame inside generatePlayableVideo
        }
      }

      const videoRes = await generatePlayableVideo({
        prompt: payload.prompt,
        style: payload.style,
        aspectRatio: payload.aspectRatio,
        quality: payload.quality || 'standard',
        durationSec: payload.durationSec || 4,
        baseImageDataUrl: baseFrameUrl,
        offlineMode,
      });

      if (addToChat && convId) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assistantMsg: Message = {
          id: 'msg-' + (Date.now() + 1),
          conversationId: convId,
          userId: currentUser?.id,
          role: 'assistant',
          content:
            videoRes.mode === 'offline'
              ? 'Generated 100% offline on your device (No internet required).'
              : 'Generated via Offnex Video Studio.',
          timestamp: timeString,
          modelUsed: videoRes.modelUsed,
          videoGeneration: {
            prompt: payload.prompt,
            style: payload.style,
            aspectRatio: payload.aspectRatio,
            durationSec: videoRes.durationSec,
            videoUrl: videoRes.videoUrl,
            posterUrl: videoRes.posterUrl,
            mimeType: videoRes.mimeType,
            mode: videoRes.mode,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        await db.saveMessage(assistantMsg);

        const targetConv = newlyCreatedConv || conversations.find((c) => c.id === convId);
        if (targetConv) {
          const updated: Conversation = {
            ...targetConv,
            userId: targetConv.userId || currentUser?.id,
            userEmail: targetConv.userEmail || currentUser?.email,
            userName: targetConv.userName || ownerName,
            title:
              targetConv.title === 'New Offline Chat'
                ? `Video: ${payload.prompt.slice(0, 26)}`
                : targetConv.title,
            updatedAt: new Date().toISOString(),
            messagesCount: (targetConv.messagesCount || 0) + (newlyCreatedConv ? 1 : 2),
          };
          await db.saveConversation(updated);
          setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
          void syncConversationToBackend(
            updated,
            chatUserMsg ? [chatUserMsg, assistantMsg] : [assistantMsg]
          );
        } else {
          void syncConversationToBackend(undefined, [assistantMsg]);
        }
      }

      const videoRecord: GeneratedImageRecord = {
        id: 'vidrec-' + Date.now(),
        userId: uid,
        userEmail: currentUser?.email,
        userName: ownerName,
        conversationId: addToChat ? convId || undefined : undefined,
        prompt: payload.prompt,
        style: payload.style,
        aspectRatio: payload.aspectRatio,
        quality: payload.quality || 'standard',
        count: 1,
        modelUsed: videoRes.modelUsed,
        provider: offlineMode ? 'local' : 'gemini',
        images: [
          {
            id: 'poster-' + Date.now(),
            dataUrl: videoRes.posterUrl,
            mimeType: 'image/jpeg',
          },
        ],
        mediaType: 'video',
        videoUrl: videoRes.videoUrl,
        createdAt: new Date().toISOString(),
      };
      await db.saveImageRecord(videoRecord);
      void syncImageRecordToBackend(videoRecord);
      setImageHistory((prev) => [videoRecord, ...prev]);
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || 'Video generation failed.';
      setLastImageError(errMsg);
      if (addToChat && convId) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const errAssistantMsg: Message = {
          id: 'msg-' + (Date.now() + 1),
          conversationId: convId,
          role: 'assistant',
          content: '',
          timestamp: timeString,
          modelUsed: 'Offnex Video Studio',
          videoGeneration: {
            prompt: payload.prompt,
            style: payload.style,
            aspectRatio: payload.aspectRatio,
            durationSec: payload.durationSec || 4,
            videoUrl: '',
            mimeType: 'video/webm',
            mode: offlineMode ? 'offline' : 'online',
            error: errMsg,
          },
        };
        setMessages((prev) => [...prev, errAssistantMsg]);
        await db.saveMessage(errAssistantMsg);
      }
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleDeleteImageHistory = async (id: string) => {
    const uid = currentUser?.id || 'anonymous';
    await db.deleteImageRecord(id, uid);
    void deleteImageRecordOnBackend(id, uid);
    setImageHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // File Upload & Chat Analysis
  const handleUploadFile = async (file: File) => {
    const rawDoc = await documentProcessor.processFile(file);
    const doc: StoredDocument = {
      ...rawDoc,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
    };
    await db.saveDocument(doc);
    void syncDocumentToBackend(doc);
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
    const res = await aiEngine.generateResponse(queryText, {
      language,
      offlineStrict: settings.offlineStrict || !isNetworkOnline,
    });
    return res.text;
  };

  // Language update
  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    const updated = { ...settings, language: newLang };
    setSettings(updated);
    await db.saveSettings(updated);
    void syncSettingsToBackend(updated);
  };

  // Toggle Offline Mode vs Online Mode from header / quick switch
  const handleToggleOfflineMode = async () => {
    const updated = { ...settings, offlineStrict: !settings.offlineStrict };
    setSettings(updated);
    await db.saveSettings(updated);
    void syncSettingsToBackend(updated);
    setLastImageError(null);
  };

  // Switch Offline Mode off when user explicitly requests online cloud features
  const handleDisableOfflineMode = async () => {
    const updated = { ...settings, offlineStrict: false };
    setSettings(updated);
    await db.saveSettings(updated);
    void syncSettingsToBackend(updated);
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
        isNetworkOnline={isNetworkOnline}
        onToggleOfflineMode={handleToggleOfflineMode}
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
        <button
          type="button"
          onClick={handleToggleOfflineMode}
          title="Tap to switch Offline / Online Mode"
          className={`flex items-center gap-1.5 text-[10px] font-medium ${
            settings.offlineStrict || !isNetworkOnline
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
              : 'text-blue-400 bg-blue-500/10 border-blue-500/25'
          } px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap cursor-pointer transition-colors`}
        >
          {settings.offlineStrict || !isNetworkOnline ? (
            <WifiOff className="w-3 h-3 shrink-0" />
          ) : (
            <Wifi className="w-3 h-3 shrink-0" />
          )}
          <span>{settings.offlineStrict || !isNetworkOnline ? 'Offline' : 'Online'}</span>
        </button>
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
              offlineStrict={settings.offlineStrict}
              onToggleOfflineMode={handleToggleOfflineMode}
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
              isGeneratingVideo={isGeneratingVideo}
              onGenerateImage={handleGenerateImage}
              onGenerateVideo={handleGenerateVideo}
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
              isGeneratingVideo={isGeneratingVideo}
              lastImageError={lastImageError}
              onClearError={() => setLastImageError(null)}
              onGenerateImage={handleGenerateImage}
              onGenerateVideo={handleGenerateVideo}
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
                void syncSettingsToBackend(s);
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
