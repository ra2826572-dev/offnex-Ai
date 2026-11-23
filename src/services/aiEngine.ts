import { LocalAIModel, SupportedLanguage, DocumentChunk, SystemHardwareInfo } from '../types';
import { offlineAiEngine } from './offlineAiEngine';

export const SUPPORTED_LOCAL_MODELS: LocalAIModel[] = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Google Gemini 3.1 Flash Lite',
    tag: 'gemini-3.1-flash-lite',
    size: 'Cloud / Offline Hybrid',
    parameters: 'Fast',
    description: 'Ultra-fast model for instant everyday chat online, with full on-device Offline AI fallback.',
    family: 'gemini',
    minRamGb: 0,
    recommendedRamGb: 0,
    isInstalled: true,
    isDefault: true,
    status: 'ready',
    languagesSupported: ['en', 'ur', 'roman_ur', 'ar', 'hi'],
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'Google Gemini 4 Hydrogen',
    tag: 'gemini-4-hydrogen',
    size: 'Cloud / Offline Hybrid',
    parameters: 'Versatile',
    description: 'Versatile general model online with automatic on-device Offline AI execution when offline.',
    family: 'gemini',
    minRamGb: 0,
    recommendedRamGb: 0,
    isInstalled: true,
    isDefault: false,
    status: 'ready',
    languagesSupported: ['en', 'ur', 'roman_ur', 'ar', 'hi'],
  },
];

export class LocalAIEngine {
  private activeModel: string = 'gemini-3.1-flash-lite';
  private ollamaAvailable: boolean = false;
  private ollamaVersion: string = '';
  private hardwareInfo: SystemHardwareInfo | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkOllamaStatus();
      this.fetchHardwareInfo();
    }
  }

  public async checkOllamaStatus(): Promise<{ connected: boolean; version?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.ollamaAvailable = false;
      return { connected: false };
    }
    try {
      const res = await fetch('/api/ollama/status').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        this.ollamaAvailable = data.connected;
        this.ollamaVersion = data.version || '';
        return { connected: data.connected, version: data.version };
      }
    } catch {
      // offline / unavailable
    }
    this.ollamaAvailable = false;
    return { connected: false };
  }

  public isOllamaConnected(): boolean {
    return this.ollamaAvailable;
  }

  public getOllamaVersion(): string {
    return this.ollamaVersion;
  }

  public async fetchHardwareInfo(): Promise<SystemHardwareInfo> {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/system/info');
        if (res.ok) {
          const data = await res.json();
          this.hardwareInfo = data;
          return data;
        }
      } catch {
        // Fallback client estimates
      }
    }
    const fallback: SystemHardwareInfo = {
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Desktop',
      arch: 'x64',
      totalMemGb: 8,
      freeMemGb: 4.2,
      cpuCount: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 8,
      cpuModel: 'Local Device Processor',
      isTauriSupported: true,
      hasAvx2: true,
    };
    this.hardwareInfo = fallback;
    return fallback;
  }

  public getHardwareInfo(): SystemHardwareInfo | null {
    return this.hardwareInfo;
  }

  public setActiveModel(modelTag: string) {
    this.activeModel = modelTag;
  }

  public getActiveModel(): string {
    return this.activeModel;
  }

  private async streamTextToCallback(text: string, onToken?: (token: string) => void): Promise<void> {
    if (!onToken) return;
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      onToken(chunk);
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
    }
  }

  private async tryOllamaChat(
    prompt: string,
    context?: {
      history?: { role: 'user' | 'assistant'; content: string }[];
      documentChunks?: DocumentChunk[];
      language?: SupportedLanguage;
      temperature?: number;
    }
  ): Promise<string | null> {
    try {
      const messages = [
        ...(context?.history || []).slice(-12).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: prompt },
      ];
      const res = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel.startsWith('gemini-') ? 'gemma2:2b' : this.activeModel,
          messages,
          stream: false,
          options: { temperature: context?.temperature ?? 0.7 },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const content = data?.message?.content || data?.response || '';
      return typeof content === 'string' && content.trim() ? content.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Main completion method.
   * Respects offlineStrict toggle & real browser connectivity:
   * - Online Mode: Calls server-side Gemini API with conversation history & document context (falls back to offline engine on network failure).
   * - Offline Mode (or !navigator.onLine): Runs local Ollama if connected, or full on-device Offline AI Engine seamlessly.
   */
  public async generateResponse(
    prompt: string,
    context?: {
      history?: { role: 'user' | 'assistant'; content: string }[];
      documentChunks?: DocumentChunk[];
      language?: SupportedLanguage;
      temperature?: number;
      offlineStrict?: boolean;
    },
    onToken?: (token: string) => void
  ): Promise<{ text: string; sources?: { documentName: string; page: number; text: string }[]; suggestedActions?: string[] }> {
    const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const useOfflineMode = Boolean(context?.offlineStrict) || isBrowserOffline;

    // 1. Offline Mode (explicitly selected OR browser disconnected) -> never send cloud requests
    if (useOfflineMode) {
      if (this.ollamaAvailable) {
        const ollamaReply = await this.tryOllamaChat(prompt, context);
        if (ollamaReply) {
          await this.streamTextToCallback(ollamaReply, onToken);
          return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
        }
      }
      return this.generateOfflineResponse(prompt, context, onToken);
    }

    // 2. If explicitly using a local Ollama model while connected
    if (!this.activeModel.startsWith('gemini-') && this.ollamaAvailable) {
      const ollamaReply = await this.tryOllamaChat(prompt, context);
      if (ollamaReply) {
        await this.streamTextToCallback(ollamaReply, onToken);
        return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
      }
    }

    // 3. Call Server-Side Gemini API when online
    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: this.activeModel.startsWith('gemini-') ? this.activeModel : 'gemini-3.1-flash-lite',
          context,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        code?: string;
      };

      if (response.ok && data.text) {
        await this.streamTextToCallback(data.text, onToken);
        return {
          text: data.text,
          suggestedActions: ['Summary', 'More Details'],
        };
      }

      // If Gemini failed (e.g. key issue), try connected local Ollama first
      if (this.ollamaAvailable) {
        const ollamaReply = await this.tryOllamaChat(prompt, context);
        if (ollamaReply) {
          await this.streamTextToCallback(ollamaReply, onToken);
          return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
        }
      }

      const errorText =
        data.error ||
        `AI service returned HTTP ${response.status}. Please check your Gemini API key in Settings > Secrets.`;
      await this.streamTextToCallback(errorText, onToken);
      return {
        text: errorText,
        suggestedActions: ['Retry'],
      };
    } catch (err) {
      console.warn('Gemini API request network error, switching cleanly to Offline AI Engine:', err);
      if (this.ollamaAvailable) {
        const ollamaReply = await this.tryOllamaChat(prompt, context);
        if (ollamaReply) {
          await this.streamTextToCallback(ollamaReply, onToken);
          return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
        }
      }
      return this.generateOfflineResponse(prompt, context, onToken);
    }
  }

  private async generateOfflineResponse(
    prompt: string,
    context?: {
      history?: { role: 'user' | 'assistant'; content: string }[];
      documentChunks?: DocumentChunk[];
      language?: SupportedLanguage;
      temperature?: number;
    },
    onToken?: (token: string) => void
  ): Promise<{ text: string; sources?: { documentName: string; page: number; text: string }[]; suggestedActions?: string[] }> {
    const result = await offlineAiEngine.generate(prompt, context);
    await this.streamTextToCallback(result.text, onToken);
    return result;
  }
}

export const aiEngine = new LocalAIEngine();
