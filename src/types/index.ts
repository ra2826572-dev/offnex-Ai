export type NavigationTab = 
  | 'home' 
  | 'chat' 
  | 'images' 
  | 'voice' 
  | 'settings';

export type SupportedLanguage = 'en' | 'ur' | 'roman_ur' | 'ar' | 'hi';

export type ImageStyle =
  | 'Realistic Photography'
  | '3D Rendering'
  | 'Anime'
  | 'Digital Art'
  | 'Cinematic'
  | 'Illustration'
  | 'Logo Design'
  | 'Product Photography'
  | 'Social Media Graphics';

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3';
export type ImageQuality = 'standard' | 'high';

export interface GeneratedImageItem {
  id: string;
  dataUrl: string;
  mimeType: string;
}

export interface GeneratedImageRecord {
  id: string;
  userId: string;
  conversationId?: string;
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  count: number;
  modelUsed: string;
  provider: 'gemini' | 'local' | 'openai';
  images: GeneratedImageItem[];
  hasReferenceImage?: boolean;
  createdAt: string;
}

export interface MessageImagePayload {
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  count: number;
  provider: 'gemini' | 'local' | 'openai';
  images: GeneratedImageItem[];
  referencePreviewUrl?: string;
  error?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  modelUsed?: string;
  sources?: {
    documentName: string;
    page: number;
    text: string;
  }[];
  suggestedActions?: string[];
  isStreaming?: boolean;
  imageGeneration?: MessageImagePayload;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  modelName: string;
  language: SupportedLanguage;
  messagesCount: number;
  tags?: string[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  keywords: string[];
}

export interface StoredDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  pageCount: number;
  summary?: string;
  content: string;
  chunks: DocumentChunk[];
}

export interface KnowledgeNote {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
}

export interface KnowledgeFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CourseQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  summary: string;
  content: string;
  completed: boolean;
  quiz?: CourseQuizQuestion[];
}

export interface LearningCourse {
  id: string;
  title: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  iconName: string;
  badgeColor: string;
  lessons: CourseLesson[];
  enrolled: boolean;
  progressPercent: number;
}

export interface LocalAIModel {
  id: string;
  name: string;
  tag: string;
  size: string;
  parameters: string;
  description: string;
  family: 'gemma' | 'qwen' | 'llama' | 'mistral' | 'phi' | 'gemini';
  minRamGb: number;
  recommendedRamGb: number;
  isInstalled: boolean;
  isDefault?: boolean;
  downloadProgress?: number;
  status: 'ready' | 'downloading' | 'not_installed' | 'error';
  languagesSupported: SupportedLanguage[];
}

export interface AppSettings {
  language: SupportedLanguage;
  theme: 'dark' | 'light';
  defaultModel: string;
  ollamaHost: string;
  temperature: number;
  contextWindow: number;
  speechSpeed: number;
  ttsVoice: string;
  offlineStrict: boolean;
  autoSaveHistory: boolean;
  enableSoundEffects: boolean;
}

export interface SystemHardwareInfo {
  platform: string;
  arch: string;
  totalMemGb: number;
  freeMemGb: number;
  cpuCount: number;
  cpuModel: string;
  isTauriSupported: boolean;
  hasAvx2: boolean;
}

export type UserRole = 'user' | 'business_owner';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  passwordHash?: string;
}

export type AuthMode = 'signin' | 'signup';

export type AdminSection =
  | 'dashboard'
  | 'users'
  | 'chats'
  | 'images'
  | 'models'
  | 'api'
  | 'settings'
  | 'analytics'
  | 'logs'
  | 'tickets';

export interface AdminActivityLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  actor?: string;
  source?: 'client' | 'server';
}

export interface SupportTicket {
  id: string;
  subject: string;
  userEmail: string;
  userName: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRuntimeConfig {
  defaultChatModel: string;
  defaultImageModel: string;
  highQualityImageModel: string;
  imageRateLimitMax: number;
  imageRateLimitWindowMinutes: number;
  maintenanceMode: boolean;
  allowLocalFallback: boolean;
  ollamaHost: string;
}

export interface AdminOverviewResponse {
  hardware: {
    platform: string;
    arch: string;
    totalMemGb: number;
    freeMemGb: number;
    usedMemGb: number;
    cpuCount: number;
    cpuModel: string;
    uptimeSec: number;
    nodeVersion: string;
  };
  providers: {
    geminiChat: {
      configured: boolean;
      model: string;
      status: 'online' | 'unconfigured';
    };
    geminiImage: {
      configured: boolean;
      keySource: 'IMAGE_GENERATION_API_KEY' | 'GEMINI_API_KEY' | 'none';
      modelStandard: string;
      modelHigh: string;
      status: 'online' | 'unconfigured';
    };
    openai: {
      configured: boolean;
      model: string;
      status: 'online' | 'unconfigured';
    };
    ollama: {
      connected: boolean;
      version?: string;
      host: string;
      status: 'online' | 'offline';
    };
    localSd: {
      available: boolean;
      endpoint: string;
      modelsCount: number;
      error?: string;
      status: 'online' | 'offline';
    };
  };
  config: AdminRuntimeConfig;
  logs: AdminActivityLog[];
}

