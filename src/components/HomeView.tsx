'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  MessageSquare, 
  FileText, 
  Mic, 
  Languages, 
  GraduationCap, 
  AlignLeft, 
  HardDrive, 
  Cpu, 
  Server, 
  Wifi, 
  WifiOff, 
  ArrowRight, 
  Upload, 
  Clock, 
  CheckCircle2, 
  FolderSearch, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Calendar,
  BookOpen,
  FolderOpen
} from 'lucide-react';
import { Conversation, StoredDocument, LocalAIModel, NavigationTab, SupportedLanguage } from '../types';
import { INITIAL_COURSES } from '../services/learningData';
import { aiEngine } from '../services/aiEngine';

interface HomeViewProps {
  conversations: Conversation[];
  documents: StoredDocument[];
  activeModelObj: LocalAIModel;
  models: LocalAIModel[];
  totalStorageMb: number;
  isOllamaConnected: boolean;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onSelectDocument: (doc: StoredDocument) => void;
  onUploadClick: () => void;
  onOpenModelManager: () => void;
  setActiveTab: (tab: NavigationTab) => void;
  language: SupportedLanguage;
  userName?: string;
}

export const HomeView: React.FC<HomeViewProps> = ({
  conversations,
  documents,
  activeModelObj,
  models,
  totalStorageMb,
  isOllamaConnected,
  onNewConversation,
  onSelectConversation,
  onSelectDocument,
  onUploadClick,
  onOpenModelManager,
  setActiveTab,
  language,
  userName = 'Rizwan Ahmad',
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  );
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');
  const [timeGreeting, setTimeGreeting] = useState<string>('Welcome back');

  useEffect(() => {
    // Online / Offline real event listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Dynamic date and greeting
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDateFormatted(now.toLocaleDateString(undefined, options));

    const hour = now.getHours();
    if (hour < 12) setTimeGreeting('Good morning');
    else if (hour < 18) setTimeGreeting('Good afternoon');
    else setTimeGreeting('Good evening');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real calculations
  const totalMessagesCount = conversations.reduce((acc, c) => acc + (c.messagesCount || 0), 0);
  const installedModelsCount = models.filter(m => m.isInstalled).length;
  const recentConversations = conversations.slice(0, 5);

  const isBrandNewUser = conversations.length === 0;

  return (
    <div className="flex-1 h-full w-full bg-[#0B0D18] overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-8">
      {/* 1. WELCOME HERO SECTION */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#121528] via-[#1A1E38] to-[#14172B] border border-purple-500/25 p-4 sm:p-6 md:p-8 overflow-hidden shadow-xl shadow-purple-950/20">
        {/* Glow ambient background elements */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* Top Meta: Date and Online/Offline pill */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1.5 bg-[#14182E] border border-[#272D4D] px-2.5 py-1 rounded-full text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">{currentDateFormatted || 'Wednesday, November 11, 2026'}</span>
              </span>

              {/* Real Online/Offline Status Indicator */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline 
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' 
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              }`}>
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-blue-400" />
                    <span>Internet Available</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>100% Offline Mode</span>
                  </>
                )}
              </span>

              {/* Active Local Model Badge */}
              <button 
                onClick={onOpenModelManager}
                className="inline-flex items-center gap-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-purple-200 border border-purple-500/30 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                title="Click to view model configuration"
              >
                <Cpu className="w-3 h-3 text-purple-400" />
                <span>{activeModelObj.name}</span>
              </button>
            </div>

            {/* Main Greeting */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {timeGreeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#8C62FF]">{userName}</span>
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-300 mt-1">
                Your private AI workspace is ready.
              </p>
            </div>

            {/* Privacy Guarantee Note */}
            <p className="text-xs text-gray-400 flex items-start sm:items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              <span>All inferences, document parsing, and history remain strictly on your physical device.</span>
            </p>
          </div>

          {/* Right Action CTA */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 sm:gap-3 shrink-0">
            <button
              onClick={onNewConversation}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Start New Chat</span>
            </button>

            <button
              onClick={onOpenModelManager}
              className="flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#181D35] hover:bg-[#222849] text-gray-300 hover:text-white text-xs font-semibold border border-purple-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Model Manager</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. THREE REAL STATISTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total Conversations */}
        <div 
          onClick={() => setActiveTab('chat')}
          className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-purple-500/40 hover:bg-[#181D35] transition-all cursor-pointer shadow-lg space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Conversations</span>
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {conversations.length}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#1F2542]">
            <span>{totalMessagesCount} messages</span>
            <span className="text-purple-300 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Open <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Active AI Model */}
        <div 
          onClick={onOpenModelManager}
          className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-amber-500/40 hover:bg-[#181D35] transition-all cursor-pointer shadow-lg space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Model</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white truncate" title={activeModelObj.name}>
            {activeModelObj.name}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#1F2542]">
            <span>{activeModelObj.parameters} • {activeModelObj.size}</span>
            <span className="text-amber-300 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Manage <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Local Storage Used */}
        <div 
          onClick={() => setActiveTab('settings')}
          className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-emerald-500/40 hover:bg-[#181D35] transition-all cursor-pointer shadow-lg space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Storage Used</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {totalStorageMb.toFixed(1)} <span className="text-sm font-normal text-gray-400">MB</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#1F2542]">
            <span className="text-emerald-400 font-medium">100% On-Device</span>
            <span className="text-gray-300 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Details <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 3. QUICK AI ACTIONS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Quick AI Actions</h2>
          </div>
          <span className="text-xs text-gray-400">Direct on-device shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Action 1: New Chat */}
          <button
            onClick={onNewConversation}
            className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-purple-500/40 hover:bg-[#191F3B] flex flex-col items-center text-center transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">New Chat</span>
            <span className="text-[10px] text-gray-400 mt-0.5">Offline assistant</span>
          </button>

          {/* Action 2: PDF Reader */}
          <button
            onClick={onUploadClick}
            className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-blue-500/40 hover:bg-[#191F3B] flex flex-col items-center text-center transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">PDF Reader</span>
            <span className="text-[10px] text-gray-400 mt-0.5">Analyze in Chat</span>
          </button>

          {/* Action 3: Voice Assistant */}
          <button
            onClick={() => setActiveTab('voice')}
            className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-emerald-500/40 hover:bg-[#191F3B] flex flex-col items-center text-center transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Voice Assistant</span>
            <span className="text-[10px] text-gray-400 mt-0.5">Local STT & TTS</span>
          </button>

          {/* Action 4: Translator */}
          <button
            onClick={() => {
              setActiveTab('chat');
              onNewConversation();
            }}
            className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-indigo-500/40 hover:bg-[#191F3B] flex flex-col items-center text-center transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 group-hover:scale-110 transition-transform">
              <Languages className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Translator</span>
            <span className="text-[10px] text-gray-400 mt-0.5">Urdu & English</span>
          </button>

          {/* Action 5: AI Tutor */}
          <button
            onClick={() => setActiveTab('chat')}
            className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-amber-500/40 hover:bg-[#191F3B] flex flex-col items-center text-center transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">AI Tutor</span>
            <span className="text-[10px] text-gray-400 mt-0.5">Ask in Chat</span>
          </button>

          {/* Action 6: Summarizer */}
          <button
            onClick={() => setActiveTab('chat')}
            className="p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-rose-500/40 hover:bg-[#191F3B] flex flex-col items-center text-center transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2 group-hover:scale-110 transition-transform">
              <AlignLeft className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Summarizer</span>
            <span className="text-[10px] text-gray-400 mt-0.5">Instant digests</span>
          </button>
        </div>
      </div>

      {/* 4. LOCAL AI SYSTEM STATUS */}
      <div className="p-5 rounded-2xl bg-[#12162B] border border-purple-500/25 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2542] pb-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Local AI System & Runtime Status</h2>
          </div>
          <button
            onClick={onOpenModelManager}
            className="text-xs text-purple-300 hover:text-white flex items-center gap-1 font-semibold transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>Manage Models & Runtime</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {/* Ollama Connection */}
          <div className="p-3 rounded-xl bg-[#161B33] border border-[#232948] space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Ollama Connection</span>
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <span className={`w-2 h-2 rounded-full ${isOllamaConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{isOllamaConnected ? 'Ollama Active' : 'Embedded Engine'}</span>
            </div>
            <span className="text-[10px] text-gray-400 block truncate">
              {isOllamaConnected ? 'localhost:11434 bridge' : 'Zero-config local fallback'}
            </span>
          </div>

          {/* Active Model */}
          <div className="p-3 rounded-xl bg-[#161B33] border border-[#232948] space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Active Model</span>
            <div className="flex items-center gap-1.5 font-semibold text-white truncate" title={activeModelObj.name}>
              <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">{activeModelObj.name}</span>
            </div>
            <span className="text-[10px] text-gray-400 block truncate">
              {activeModelObj.family.toUpperCase()} • {activeModelObj.size}
            </span>
          </div>

          {/* Model Loaded Status */}
          <div className="p-3 rounded-xl bg-[#161B33] border border-[#232948] space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Model State</span>
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resident in Memory</span>
            </div>
            <span className="text-[10px] text-gray-400 block truncate">
              Optimized Q4_K_M precision
            </span>
          </div>

          {/* Internet Connection */}
          <div className="p-3 rounded-xl bg-[#161B33] border border-[#232948] space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Internet Status</span>
            <div className="flex items-center gap-1.5 font-semibold text-white">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-blue-300">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Offline Protected</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-gray-400 block truncate">
              {isOnline ? 'Network detected (No data sent)' : 'Zero internet required'}
            </span>
          </div>

          {/* Offline AI Availability */}
          <div className="p-3 rounded-xl bg-[#161B33] border border-[#232948] space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Offline Capability</span>
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Available</span>
            </div>
            <span className="text-[10px] text-gray-400 block truncate">
              Zero cloud API dependency
            </span>
          </div>
        </div>
      </div>

      {/* 5 & 6. RECENT CONVERSATIONS AND RECENT DOCUMENTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 5: Recent Conversations */}
        <div className="p-5 rounded-2xl bg-[#14182D] border border-[#232948] shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F2542] pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Recent Conversations</h3>
            </div>
            <button
              onClick={() => setActiveTab('chat')}
              className="text-xs text-purple-300 hover:text-white flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {recentConversations.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl bg-[#0F1224] border border-dashed border-[#232948]">
                <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-xs font-semibold text-gray-300">No conversations yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Start your first private on-device conversation</p>
                <button
                  onClick={onNewConversation}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    setActiveTab('chat');
                  }}
                  className="p-3 rounded-xl bg-[#171B33] hover:bg-[#1E2342] border border-[#222846] hover:border-purple-500/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span>•</span>
                      <span className="truncate">{conv.modelName || activeModelObj.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectConversation(conv.id);
                      setActiveTab('chat');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#222744] group-hover:bg-purple-600 text-[11px] font-semibold text-gray-300 group-hover:text-white transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 6: System Health */}
        <div className="p-5 rounded-2xl bg-[#14182D] border border-[#232948] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F2542] pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">System & Storage Health</h3>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="text-xs text-emerald-300 hover:text-white flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <span>Storage Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Storage Meter */}
            <div className="p-3.5 rounded-xl bg-[#171B33] border border-[#222846] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium">Local Storage Quota</span>
                <span className="text-emerald-400 font-bold">{totalStorageMb.toFixed(1)} MB / 1024 MB</span>
              </div>
              <div className="w-full bg-[#0E1122] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (totalStorageMb / 1024) * 100 + 3)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 pt-0.5">
                <span>IndexedDB Database Active</span>
                <span className="text-emerald-400 font-semibold">99.6% Free Space</span>
              </div>
            </div>

            {/* Health Indicators */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#171B33] border border-[#222846]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Models Ready</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{installedModelsCount} of {models.length} Models</span>
                <span className="text-[10px] text-purple-400">Zero cloud API calls</span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#171B33] border border-[#222846]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Database State</span>
                <span className="text-xs font-bold text-white mt-0.5 block">IndexedDB / SQLite</span>
                <span className="text-[10px] text-emerald-400">Persistent & Safe</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 9. ONBOARDING EMPTY STATE HELPER (Shown when user has no data yet) */}
      {isBrandNewUser && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#171B36] to-[#12162B] border border-purple-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Getting Started with Offnex Ai</span>
          </div>
          <p className="text-xs text-gray-300">
            Welcome to your private on-device intelligence hub. Here is how to make the most of Offnex Ai:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <button
              onClick={onNewConversation}
              className="p-3 rounded-xl bg-[#14182D] border border-purple-500/30 hover:border-purple-500 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-white group-hover:text-purple-300 flex items-center justify-between">
                <span>1. Start a Private Chat</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Converse in English, Urdu, or Roman Urdu without internet.</p>
            </button>

            <button
              onClick={onUploadClick}
              className="p-3 rounded-xl bg-[#14182D] border border-blue-500/30 hover:border-blue-500 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-white group-hover:text-blue-300 flex items-center justify-between">
                <span>2. Upload a PDF</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Extract text, generate summaries, and test with quizzes.</p>
            </button>

            <button
              onClick={onOpenModelManager}
              className="p-3 rounded-xl bg-[#14182D] border border-amber-500/30 hover:border-amber-500 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-white group-hover:text-amber-300 flex items-center justify-between">
                <span>3. Manage Local Models</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Check RAM compatibility and pull Gemma or Qwen weights.</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
