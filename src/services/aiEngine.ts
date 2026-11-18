import { LocalAIModel, SupportedLanguage, DocumentChunk, SystemHardwareInfo } from '../types';

export const SUPPORTED_LOCAL_MODELS: LocalAIModel[] = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Google Gemini 4 Hydrogen',
    tag: 'gemini-4-hydrogen',
    size: 'Cloud',
    parameters: 'N/A',
    description: 'Fast and versatile model for every general, coding, math, and multilingual task.',
    family: 'gemini',
    minRamGb: 0,
    recommendedRamGb: 0,
    isInstalled: true,
    isDefault: true,
    status: 'ready',
    languagesSupported: ['en', 'ur', 'roman_ur', 'ar', 'hi'],
  },
];

export class LocalAIEngine {
  private activeModel: string = 'gemini-4-hydrogen';
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
      if (i % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
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
   * Calls server-side Gemini API with full conversation history & document context,
   * supports local Ollama when connected, and surfaces real API errors clearly.
   */
  public async generateResponse(
    prompt: string,
    context?: {
      history?: { role: 'user' | 'assistant'; content: string }[];
      documentChunks?: DocumentChunk[];
      language?: SupportedLanguage;
      temperature?: number;
    },
    onToken?: (token: string) => void
  ): Promise<{ text: string; sources?: { documentName: string; page: number; text: string }[]; suggestedActions?: string[] }> {
    const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // If explicitly using a local Ollama model while connected
    if (!this.activeModel.startsWith('gemini-') && this.ollamaAvailable) {
      const ollamaReply = await this.tryOllamaChat(prompt, context);
      if (ollamaReply) {
        await this.streamTextToCallback(ollamaReply, onToken);
        return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
      }
    }

    // 1. Call Server-Side Gemini API when online
    if (!isBrowserOffline) {
      try {
        const response = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: this.activeModel.startsWith('gemini-') ? this.activeModel : 'gemini-4-hydrogen',
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

        // If Gemini failed (e.g. invalid API key), try connected local Ollama if available
        if (this.ollamaAvailable) {
          const ollamaReply = await this.tryOllamaChat(prompt, context);
          if (ollamaReply) {
            await this.streamTextToCallback(ollamaReply, onToken);
            return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
          }
        }

        // Propagate upstream error cleanly instead of masking with static canned output
        const errorText =
          data.error ||
          `AI service returned HTTP ${response.status}. Please check your Gemini API key in Settings > Secrets.`;
        await this.streamTextToCallback(errorText, onToken);
        return {
          text: errorText,
          suggestedActions: ['Retry'],
        };
      } catch (err) {
        console.warn('Gemini API request network error:', err);
        if (this.ollamaAvailable) {
          const ollamaReply = await this.tryOllamaChat(prompt, context);
          if (ollamaReply) {
            await this.streamTextToCallback(ollamaReply, onToken);
            return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
          }
        }
      }
    }

    // 2. Truly offline fallback (no internet / unreachable server)
    if (this.ollamaAvailable) {
      const ollamaReply = await this.tryOllamaChat(prompt, context);
      if (ollamaReply) {
        await this.streamTextToCallback(ollamaReply, onToken);
        return { text: ollamaReply, suggestedActions: ['Summary', 'More Details'] };
      }
    }

    return this.generateOfflineResponse(prompt, context, onToken);
  }

  private evaluateSimpleMath(input: string): string | null {
    const cleaned = input
      .replace(/what is|calculate|solve|kitna hota hai|batao|=|\?/gi, '')
      .trim();
    if (!cleaned || !/^[0-9+\-*/().\s%^]+$/.test(cleaned)) return null;
    try {
      const expr = cleaned.replace(/\^/g, '**');
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result === 'number' && Number.isFinite(result)) {
        return `${cleaned} = **${result}**`;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async generateOfflineResponse(
    prompt: string,
    context?: {
      history?: { role: 'user' | 'assistant'; content: string }[];
      documentChunks?: DocumentChunk[];
      language?: SupportedLanguage;
    },
    onToken?: (token: string) => void
  ): Promise<{ text: string; sources?: { documentName: string; page: number; text: string }[]; suggestedActions?: string[] }> {
    const p = prompt.trim().toLowerCase();
    const isUrduQuery =
      /pakistan|economy|urdu|report|kar|hai|batao|kya|mujhe|kaise|tareeqa|seekhna|faiday|hoga|madad|salam|assalam/i.test(
        prompt
      ) || /[\u0600-\u06FF]/.test(prompt);

    let responseText = '';
    let actions: string[] = ['Summary', 'More Details'];
    let sources: { documentName: string; page: number; text: string }[] | undefined;

    const mathAnswer = this.evaluateSimpleMath(prompt);

    if (context?.documentChunks && context.documentChunks.length > 0) {
      const topChunk = context.documentChunks[0];
      sources = context.documentChunks.slice(0, 3).map((c) => ({
        documentName: `Document Page ${c.pageNumber}`,
        page: c.pageNumber,
        text: c.text,
      }));
      responseText = `Based on the uploaded document (**Page ${topChunk.pageNumber}**):\n\n> "${topChunk.text}"`;
      actions = ['Generate Quiz', 'Full Summary'];
    } else if (mathAnswer) {
      responseText = mathAnswer;
    } else if (/^(hi|hello|hey|salam|assalam|assalamu)/i.test(p)) {
      responseText = isUrduQuery
        ? 'Walaikum Assalam! Main aap ki kya madad kar sakta hoon? Aap mujh se kisi bhi topic, math, coding, ya general knowledge ke baray mein pooch sakte hain.'
        : 'Hello! How can I help you today? Feel free to ask any question.';
    } else {
      responseText =
        'You appear to be offline and local Ollama is not running. Please reconnect to the internet (with a valid Gemini API key in Settings > Secrets) or start Ollama locally to get full AI answers for any topic.';
    }

    await this.streamTextToCallback(responseText, onToken);
    return { text: responseText, sources, suggestedActions: actions };
  }
}

export const aiEngine = new LocalAIEngine();
