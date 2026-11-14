'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Mic,
  Download,
  Copy,
  Check,
  Brain,
  CheckCheck,
  Sparkles,
  RotateCw,
  FolderOpen,
  Wand2,
  X,
  RefreshCw,
  Maximize2,
  AlertCircle,
  PanelLeft,
} from 'lucide-react';
import {
  Conversation,
  Message,
  SupportedLanguage,
  LocalAIModel,
  ImageStyle,
  ImageAspectRatio,
  ImageQuality,
  GeneratedImageRecord,
} from '../types';
import {
  ValidatedReferenceImage,
  downloadGeneratedImage,
} from '../services/imageService';
import { ImageLightboxModal } from './ImageLightboxModal';

export interface ImageGenerationSubmitPayload {
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  count: number;
  provider: 'gemini' | 'local' | 'openai';
  referenceImage?: ValidatedReferenceImage;
}

interface ChatViewProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  isGeneratingImage: boolean;
  onGenerateImage: (payload: ImageGenerationSubmitPayload) => Promise<void>;
  imageHistory: GeneratedImageRecord[];
  onDeleteImageHistory: (id: string) => void;
  activeModel: string;
  onSelectModel: (modelTag: string) => void;
  supportedModels: LocalAIModel[];
  onVoiceClick: () => void;
  onUploadClick: () => void;
  language: SupportedLanguage;
  offlineStrict: boolean;
  onDisableOfflineMode?: () => void;
  userId?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  messages,
  onSendMessage,
  isGenerating,
  isGeneratingImage,
  onGenerateImage,
  activeModel,
  onVoiceClick,
  onUploadClick,
}) => {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false);
  const [downloadFormats, setDownloadFormats] = useState<Record<string, 'png' | 'jpeg'>>({});

  // Lightbox State
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    prompt: string;
    style?: string;
    aspectRatio?: string;
    modelUsed?: string;
    createdAt?: string;
    onRegenerate?: () => void;
  }>({ isOpen: false, imageUrl: '', prompt: '' });

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating, isGeneratingImage]);

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    const activeConv = conversations.find((c) => c.id === activeConversationId);
    let md = `# ${activeConv?.title || 'Offnex Ai Conversation'}\nDate: ${new Date().toLocaleString()}\nModel: ${activeModel}\n\n---\n\n`;
    for (const msg of messages) {
      md += `### ${msg.role === 'user' ? 'User' : 'Offnex Ai'} (${msg.timestamp})\n\n${msg.content}\n\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activeConv?.title || 'conversation').replace(/\s+/g, '_')}.md`;
    link.click();
  };

  return (
    <div className="flex-1 flex h-full bg-[#0B0B16] overflow-hidden min-w-0 relative">
      {/* Desktop Chat Sidebar: History & Conversations */}
      <div className="w-64 border-r border-[#1F243D] bg-[#101324] flex-col h-full shrink-0 hidden lg:flex">
        <div className="p-3 border-b border-[#1F243D] space-y-2">
          <button
            onClick={onNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white text-xs font-semibold shadow-md shadow-purple-600/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat history..."
              className="w-full bg-[#181D33] text-gray-200 text-xs rounded-lg pl-8 pr-3 py-1.5 border border-[#262C4A] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">No conversations found</div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                    isActive
                      ? 'bg-[#1C213D] text-white font-medium border border-purple-500/30'
                      : 'text-gray-300 hover:bg-[#161A30] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-purple-400' : 'text-gray-400'
                      }`}
                    />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                    title="Delete Chat"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-gray-400 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile & Tablet Conversations Slide-over Drawer */}
      {mobileChatsOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileChatsOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-[#101324] border-r border-[#1F243D] flex flex-col shadow-2xl pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-[#1F243D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Conversations</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileChatsOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
                aria-label="Close Conversations"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-[#1F243D] space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onNewConversation();
                  setMobileChatsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 min-h-[42px] px-3 rounded-xl bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white text-xs font-semibold shadow-md shadow-purple-600/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chat history..."
                  className="w-full bg-[#181D33] text-gray-200 text-sm rounded-xl pl-8 pr-3 py-2 border border-[#262C4A] focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">No conversations found</div>
              ) : (
                filteredConversations.map((c) => {
                  const isActive = c.id === activeConversationId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectConversation(c.id);
                        setMobileChatsOpen(false);
                      }}
                      className={`flex items-center justify-between p-2.5 min-h-[42px] rounded-xl cursor-pointer text-xs transition-all ${
                        isActive
                          ? 'bg-[#1C213D] text-white font-medium border border-purple-500/30'
                          : 'text-gray-300 hover:bg-[#161A30] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MessageSquare
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-purple-400' : 'text-gray-400'
                          }`}
                        />
                        <span className="truncate">{c.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        title="Delete Chat"
                        className="p-1.5 hover:text-rose-400 text-gray-400 transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="flex-1 flex flex-col h-full bg-[#0B0B16] overflow-hidden min-w-0">
        {/* Top Header of Chat */}
        <div className="h-12 sm:h-13 border-b border-[#1F243D] bg-[#0E1020]/90 px-2.5 sm:px-4 flex items-center justify-between z-10 shrink-0 gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileChatsOpen(true)}
              title="Conversations"
              aria-label="Open Conversations"
              className="lg:hidden p-1.5 text-gray-300 hover:text-white hover:bg-[#1A1F38] rounded-lg transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold text-white truncate">
              {conversations.find((c) => c.id === activeConversationId)?.title || 'AI Chat'}
            </span>
            <span className="hidden xl:inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              100% Local Inference
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Export Chat Button */}
            <button
              onClick={handleExportChat}
              title="Download Conversation as Markdown"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1A1F38] rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-5 md:px-8 py-4 sm:py-5 space-y-4 sm:space-y-5"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center glow-purple">
                <Brain className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Ready for Private Conversation
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  Ask questions, draft reports, or analyze code and documents privately.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg pt-2">
                {[
                  'Mujhe Pakistan ki economy per report do',
                  'Explain Quantum Computing to a beginner',
                  'Write a Python script for file deduplication',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#181D35] hover:bg-[#252C50] text-gray-300 hover:text-white border border-purple-500/20 transition-all cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={msg.id}
                    className="flex justify-end items-end gap-2 max-w-[90%] sm:max-w-2xl ml-auto"
                  >
                    <div className="bg-[#4435D5] text-white px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-tr-sm shadow-md shadow-purple-950/40 text-sm leading-relaxed border border-purple-400/20 space-y-2">
                      {msg.imageGeneration?.referencePreviewUrl && (
                        <div className="rounded-xl overflow-hidden border border-white/20 max-w-[180px]">
                          <img
                            src={msg.imageGeneration.referencePreviewUrl}
                            alt="Reference upload"
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-line break-words">{msg.content}</p>
                      <div className="flex items-center justify-end gap-1.5 text-[10px] text-purple-200 mt-1.5">
                        <span>{msg.timestamp}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-300 inline" />
                      </div>
                    </div>
                  </div>
                );
              }

              // Assistant message with Image Generation result or error
              if (msg.imageGeneration) {
                const imgPayload = msg.imageGeneration;
                const format = downloadFormats[msg.id] || 'png';
                return (
                  <div key={msg.id} className="flex items-start gap-2 sm:gap-3 max-w-3xl mr-auto w-full">
                    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#4435D5] to-[#7547FF] p-0.5 shrink-0 shadow-md shadow-purple-600/30 glow-purple">
                      <div className="w-full h-full bg-[#111426] rounded-xl flex items-center justify-center">
                        <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#8C62FF]" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 glass-panel rounded-2xl rounded-tl-sm p-3 sm:p-4 shadow-xl space-y-3 border border-purple-500/25">
                      {/* Header metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>AI Image Generator</span>
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-600/20 text-purple-300 border border-purple-500/25">
                            {imgPayload.style}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#181D35] text-gray-300 border border-[#272D4D]">
                            {imgPayload.aspectRatio}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#181D35] text-gray-300 border border-[#272D4D] capitalize">
                            {imgPayload.quality}
                          </span>
                        </div>
                        {msg.modelUsed && (
                          <span className="text-[10px] text-gray-400">{msg.modelUsed}</span>
                        )}
                      </div>

                      {/* Error state */}
                      {imgPayload.error ? (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <p className="leading-relaxed">{imgPayload.error}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                onGenerateImage({
                                  prompt: imgPayload.prompt,
                                  style: imgPayload.style,
                                  aspectRatio: imgPayload.aspectRatio,
                                  quality: imgPayload.quality,
                                  count: imgPayload.count,
                                  provider: imgPayload.provider,
                                })
                              }
                              disabled={isGeneratingImage}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white text-[11px] font-semibold border border-rose-500/30 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Try Again</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Generated Images Grid */}
                          <div
                            className={`grid gap-3 ${
                              imgPayload.images.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                            }`}
                          >
                            {imgPayload.images.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                className="relative group rounded-xl overflow-hidden bg-[#070812] border border-white/10 shadow-lg"
                              >
                                <img
                                  src={img.dataUrl}
                                  alt={imgPayload.prompt}
                                  onClick={() =>
                                    setLightboxState({
                                      isOpen: true,
                                      imageUrl: img.dataUrl,
                                      prompt: imgPayload.prompt,
                                      style: imgPayload.style,
                                      aspectRatio: imgPayload.aspectRatio,
                                      modelUsed: msg.modelUsed,
                                      createdAt: msg.timestamp,
                                      onRegenerate: () =>
                                        onGenerateImage({
                                          prompt: imgPayload.prompt,
                                          style: imgPayload.style,
                                          aspectRatio: imgPayload.aspectRatio,
                                          quality: imgPayload.quality,
                                          count: imgPayload.count,
                                          provider: imgPayload.provider,
                                        }),
                                    })
                                  }
                                  className={`w-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.01] ${
                                    imgPayload.images.length > 1 ? 'max-h-72' : 'max-h-[440px]'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxState({
                                      isOpen: true,
                                      imageUrl: img.dataUrl,
                                      prompt: imgPayload.prompt,
                                      style: imgPayload.style,
                                      aspectRatio: imgPayload.aspectRatio,
                                      modelUsed: msg.modelUsed,
                                    })
                                  }
                                  title="Open Full Size"
                                  className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-black/70 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-purple-600 cursor-pointer"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {msg.content && (
                            <p className="text-xs text-gray-300 leading-relaxed">{msg.content}</p>
                          )}

                          {/* Action Buttons Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#222846]">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Download Image + PNG/JPEG selector */}
                              {imgPayload.images[0] && (
                                <div className="flex items-center bg-[#14182E] border border-purple-500/30 rounded-xl overflow-hidden">
                                  <select
                                    value={format}
                                    onChange={(e) =>
                                      setDownloadFormats((prev) => ({
                                        ...prev,
                                        [msg.id]: e.target.value as 'png' | 'jpeg',
                                      }))
                                    }
                                    aria-label="Download format"
                                    className="bg-transparent text-[11px] text-gray-200 px-2 py-1.5 focus:outline-none cursor-pointer"
                                  >
                                    <option value="png" className="bg-[#14182E]">
                                      PNG
                                    </option>
                                    <option value="jpeg" className="bg-[#14182E]">
                                      JPEG
                                    </option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadGeneratedImage(
                                        imgPayload.images[0].dataUrl,
                                        imgPayload.prompt.slice(0, 32),
                                        format
                                      )
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white text-[11px] font-semibold transition-all cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download Image</span>
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  onGenerateImage({
                                    prompt: imgPayload.prompt,
                                    style: imgPayload.style,
                                    aspectRatio: imgPayload.aspectRatio,
                                    quality: imgPayload.quality,
                                    count: imgPayload.count,
                                    provider: imgPayload.provider,
                                  })
                                }
                                disabled={isGeneratingImage}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181D35] hover:bg-[#232A4A] text-purple-200 border border-purple-500/25 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerate</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopy(msg.id, imgPayload.prompt)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181D35] hover:bg-[#232A4A] text-gray-200 border border-[#272D4D] text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy Prompt</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              // Standard Text Assistant Message
              return (
                <div key={msg.id} className="flex items-start gap-2 sm:gap-3 max-w-3xl mr-auto">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#4435D5] to-[#7547FF] p-0.5 shrink-0 shadow-md shadow-purple-600/30 glow-purple">
                    <div className="w-full h-full bg-[#111426] rounded-xl flex items-center justify-center">
                      <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-[#8C62FF]" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 bg-[#16192C] border border-[#272D4D] rounded-2xl rounded-tl-sm p-3 sm:p-4 text-sm text-gray-200 shadow-lg space-y-3">
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="bg-[#1F2545] p-2 rounded-xl text-xs border border-purple-500/20 mb-2">
                        <div className="font-semibold text-purple-300 flex items-center gap-1 mb-1">
                          <FolderOpen className="w-3 h-3" />
                          <span>Sources Referenced:</span>
                        </div>
                        <div className="space-y-1 text-gray-300">
                          {msg.sources.map((s, idx) => (
                            <div key={idx} className="text-[11px] truncate">
                              • <span className="font-medium text-white">{s.documentName}</span>{' '}
                              (Page {s.page}): {s.text.slice(0, 90)}...
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="prose prose-invert max-w-none text-xs md:text-sm leading-relaxed whitespace-pre-line font-sans">
                      {msg.content}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#222842] text-[10px] text-gray-400">
                      <span>
                        {msg.timestamp} {msg.modelUsed ? `• ${msg.modelUsed}` : ''}
                      </span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-purple-300 transition-colors flex items-center gap-1"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isGenerating && (
            <div className="flex items-center gap-3 text-xs text-purple-300 pl-9 sm:pl-12 animate-pulse">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Offnex AI is thinking...</span>
            </div>
          )}

          {/* Dedicated Image Generation Loading Animation */}
          {isGeneratingImage && (
            <div className="flex items-start gap-2 sm:gap-3 max-w-xl mr-auto">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#4435D5] to-[#7547FF] p-0.5 shrink-0 shadow-md shadow-purple-600/30 glow-purple">
                <div className="w-full h-full bg-[#111426] rounded-xl flex items-center justify-center">
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300 animate-pulse" />
                </div>
              </div>
              <div className="flex-1 min-w-0 glass-panel rounded-2xl rounded-tl-sm p-3 sm:p-4 border border-purple-500/30 space-y-3">
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-xs font-bold text-white">Creating your image...</span>
                </div>
                <div className="relative h-44 w-full rounded-xl bg-gradient-to-br from-[#161932] via-[#211B45] to-[#121528] border border-purple-500/20 overflow-hidden flex flex-col items-center justify-center gap-2">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent animate-pulse" />
                  <Sparkles className="w-7 h-7 text-purple-400 animate-bounce" />
                  <span className="text-[11px] text-purple-200 font-medium">
                    Generating visual...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="p-2.5 sm:p-4 border-t border-[#1F243D] bg-[#0E1020]/90">
          <form
            onSubmit={handleSubmit}
            className="flex items-center bg-[#14172B] border border-purple-500/30 rounded-2xl px-2.5 sm:px-4 py-2 sm:py-2.5 shadow-lg focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all"
          >
            <button
              type="button"
              onClick={onUploadClick}
              title="Upload Document"
              className="p-2 sm:p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onVoiceClick}
              title="Voice Input"
              className="p-2 sm:p-1.5 text-gray-400 hover:text-purple-300 rounded-lg transition-colors cursor-pointer mr-1 sm:mr-2 shrink-0"
            >
              <Mic className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none min-w-0"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className="ml-2 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white flex items-center justify-center shadow-md shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4 fill-white" />
            </button>
          </form>
        </div>
      </div>

      {/* Full-Size Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={lightboxState.imageUrl}
        prompt={lightboxState.prompt}
        style={lightboxState.style}
        aspectRatio={lightboxState.aspectRatio}
        modelUsed={lightboxState.modelUsed}
        createdAt={lightboxState.createdAt}
        onRegenerate={lightboxState.onRegenerate}
      />
    </div>
  );
};
