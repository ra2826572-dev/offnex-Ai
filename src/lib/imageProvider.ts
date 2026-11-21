import { resolveGeminiImageApiKey } from '@/lib/geminiKey';
import {
  fetchPinterestImageAsDataUrl,
  fetchPinterestUserPins,
  searchPublicPinterestPins,
} from '@/lib/pinterest';

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3';
export type ImageQuality = 'standard' | 'high';

export interface ReferenceImageInput {
  data: string; // raw base64 (no data URL prefix)
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export type ImageProviderId = 'gemini' | 'local' | 'openai' | 'pinterest';

export interface ImageGenerationRequest {
  prompt: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  quality?: ImageQuality;
  count?: number;
  referenceImage?: ReferenceImageInput;
  provider?: ImageProviderId;
  pinterestToken?: string;
}

export interface GeneratedImageOutput {
  id: string;
  dataUrl: string;
  mimeType: string;
}

export interface ImageGenerationResponse {
  images: GeneratedImageOutput[];
  modelUsed: string;
  provider: ImageProviderId;
  textNote?: string;
}

export interface LocalSDStatus {
  available: boolean;
  endpoint: string;
  modelsCount: number;
  error?: string;
}

export interface ImageProviderCapabilities {
  cloudConfigured: boolean;
  keySource: 'IMAGE_GENERATION_API_KEY' | 'GEMINI_API_KEY' | 'none';
  openaiConfigured: boolean;
  cloudModelStandard: string;
  cloudModelHigh: string;
  localAvailable: boolean;
  localEndpoint: string;
  localError?: string;
  supportedAspectRatios: ImageAspectRatio[];
  supportedQualities: ImageQuality[];
  maxCount: number;
}

export interface ImageProvider {
  readonly id: ImageProviderId;
  generate(req: ImageGenerationRequest, signal?: AbortSignal): Promise<ImageGenerationResponse>;
}

export class ImageGenerationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: string;

  constructor(message: string, statusCode = 500, code = 'IMAGE_GEN_ERROR', details?: string) {
    super(message);
    this.name = 'ImageGenerationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const PLACEHOLDER_KEYS = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'MY_IMAGE_GENERATION_API_KEY',
  'YOUR_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'MY_OPENAI_API_KEY',
]);

export function resolveImageApiKey(): {
  apiKey: string | null;
  source: 'IMAGE_GENERATION_API_KEY' | 'GEMINI_API_KEY' | 'none';
} {
  return resolveGeminiImageApiKey();
}

export function getConfiguredImageModel(quality: ImageQuality = 'standard'): string {
  const envModel = process.env.IMAGE_GENERATION_MODEL?.trim();
  if (envModel) {
    return envModel;
  }
  return quality === 'high' ? 'gemini-nano-banana-2.1' : 'gemini-2.5-flash-image';
}

const STYLE_MODIFIERS: Record<string, string> = {
  'Realistic Photography': 'photorealistic photography, natural lighting, 85mm lens, sharp focus, ultra-detailed',
  '3D Rendering': '3D octane render, volumetric lighting, realistic shaders, studio depth, crisp geometry',
  'Anime': 'high-quality anime illustration, vibrant cel shading, expressive studio anime style, clean linework',
  'Digital Art': 'polished digital art, rich color palette, concept art illustration, intricate detail',
  'Cinematic': 'cinematic film still, dramatic lighting, anamorphic lens, atmospheric depth, color graded',
  'Illustration': 'editorial illustration, stylized brushwork, balanced composition, clean artistic detail',
  'Logo Design': 'clean modern vector logo design, minimalist iconic emblem, crisp edges, centered composition',
  'Product Photography': 'commercial studio product photography, softbox lighting, clean reflective surface, sharp product detail',
  'Social Media Graphics': 'bold modern social media graphic design, high-contrast visual composition, vibrant contemporary aesthetic',
};

export function buildStyledPrompt(prompt: string, style?: string): string {
  const cleanPrompt = prompt.trim();
  if (!style || !STYLE_MODIFIERS[style]) {
    return cleanPrompt;
  }
  return `${cleanPrompt}. Style: ${STYLE_MODIFIERS[style]}.`;
}

interface GoogleErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{ reason?: string; '@type'?: string }>;
  };
}

interface GeminiRestResponse {
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: GoogleErrorPayload['error'];
}

export async function verifyGeminiImageModelAccess(
  apiKey: string,
  model: string
): Promise<{ valid: boolean; supportedMethods: string[]; error?: string }> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
      {
        headers: {
          'x-goog-api-key': apiKey,
          'User-Agent': 'aistudio-build',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(id);
    const raw = await res.text();
    const parsed = raw ? (JSON.parse(raw) as { supportedGenerationMethods?: string[] } & GoogleErrorPayload) : {};
    if (!res.ok) {
      return {
        valid: false,
        supportedMethods: [],
        error: parsed?.error?.message || `HTTP ${res.status}`,
      };
    }
    return {
      valid: true,
      supportedMethods: parsed.supportedGenerationMethods || [],
    };
  } catch (err: unknown) {
    return {
      valid: false,
      supportedMethods: [],
      error: (err as Error)?.message || 'Failed to reach Generative Language API',
    };
  }
}

export class OpenAIImageProvider implements ImageProvider {
  public readonly id = 'openai' as const;
  private readonly apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY?.trim() || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && !PLACEHOLDER_KEYS.has(this.apiKey));
  }

  public async generate(
    req: ImageGenerationRequest,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse> {
    if (!this.isConfigured()) {
      throw new ImageGenerationError(
        'OpenAI API key is not configured. Set OPENAI_API_KEY in backend environment variables.',
        503,
        'OPENAI_NOT_CONFIGURED'
      );
    }

    const styledPrompt = buildStyledPrompt(req.prompt, req.style);
    const quality = req.quality === 'high' ? 'hd' : 'standard';
    let size = '1024x1024';
    if (req.aspectRatio === '16:9') size = '1792x1024';
    else if (req.aspectRatio === '9:16') size = '1024x1792';

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: styledPrompt,
        n: 1,
        size,
        quality,
        response_format: 'b64_json',
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('[OpenAI Image API Warning]', { status: response.status, body: errText });
      throw new ImageGenerationError(
        `OpenAI DALL-E error (HTTP ${response.status}): ${errText.slice(0, 200)}`,
        response.status,
        'OPENAI_GENERATION_FAILED',
        errText
      );
    }

    const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const items = data.data || [];
    if (items.length === 0) {
      throw new ImageGenerationError('OpenAI did not return any images.', 500, 'NO_IMAGE_RETURNED');
    }

    const images: GeneratedImageOutput[] = [];
    for (const item of items) {
      if (item.b64_json) {
        images.push({
          id: `openai-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: `data:image/png;base64,${item.b64_json}`,
          mimeType: 'image/png',
        });
      } else if (item.url) {
        images.push({
          id: `openai-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: item.url,
          mimeType: 'image/png',
        });
      }
    }

    return {
      images,
      modelUsed: 'OpenAI DALL-E 3',
      provider: 'openai',
    };
  }
}

export class GeminiImageProvider implements ImageProvider {
  public readonly id = 'gemini' as const;

  private getCredentials(): {
    apiKey: string;
    keySource: 'IMAGE_GENERATION_API_KEY' | 'GEMINI_API_KEY';
  } {
    const { apiKey, source } = resolveImageApiKey();
    if (!apiKey || source === 'none') {
      throw new ImageGenerationError(
        'Image generation API key is not configured. Set IMAGE_GENERATION_API_KEY (or GEMINI_API_KEY) on the server / Settings > Secrets.',
        503,
        'API_NOT_CONFIGURED'
      );
    }
    return { apiKey, keySource: source };
  }

  private buildGoogleError(
    statusCode: number,
    payload: GoogleErrorPayload | null,
    rawBody: string,
    model: string,
    keySource: string
  ): ImageGenerationError {
    const apiErr = payload?.error;
    const codeNum = typeof apiErr?.code === 'number' ? apiErr.code : statusCode;
    const apiStatus = apiErr?.status || 'GOOGLE_API_ERROR';
    const apiMessage = apiErr?.message || rawBody || `Google API returned HTTP ${codeNum}`;
    const reasonDetail = apiErr?.details?.find((d) => typeof d.reason === 'string')?.reason;

    console.warn('[Gemini Image API Fallback Notice]', {
      model,
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      keySource,
      httpStatus: codeNum,
      apiStatus,
      reason: reasonDetail,
      message: apiMessage,
    });

    if (codeNum === 429 || apiStatus === 'RESOURCE_EXHAUSTED' || apiMessage.toLowerCase().includes('quota')) {
      return new ImageGenerationError(
        'Image generation quota exceeded. Please try again later or check your Google AI billing and quota.',
        429,
        'RESOURCE_EXHAUSTED',
        apiMessage
      );
    }

    return new ImageGenerationError(
      `Google Gemini API Error (HTTP ${codeNum} ${apiStatus}): ${apiMessage}`,
      codeNum >= 400 && codeNum < 600 ? codeNum : 500,
      apiStatus,
      apiMessage
    );
  }

  private async generateViaRestGenerateContent(
    apiKey: string,
    keySource: string,
    model: string,
    styledPrompt: string,
    aspectRatio: ImageAspectRatio,
    quality: ImageQuality,
    referenceImage?: ReferenceImageInput,
    signal?: AbortSignal
  ): Promise<{ images: GeneratedImageOutput[]; textNote?: string }> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (referenceImage) {
      parts.push({
        inlineData: {
          mimeType: referenceImage.mimeType,
          data: referenceImage.data,
        },
      });
    }
    parts.push({ text: styledPrompt });

    const imageConfig: { aspectRatio: string; imageSize?: string } = {
      aspectRatio,
    };

    if (model === 'gemini-nano-banana-2.1' || model === 'gemini-3-pro-image') {
      imageConfig.imageSize = quality === 'high' ? '2K' : '1K';
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    const rawBody = await response.text();
    let parsed: GeminiRestResponse | null = null;
    try {
      parsed = rawBody ? (JSON.parse(rawBody) as GeminiRestResponse) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      throw this.buildGoogleError(response.status, parsed, rawBody, model, keySource);
    }

    if (parsed?.promptFeedback?.blockReason) {
      throw new ImageGenerationError(
        `Image generation blocked by Google safety filter (${parsed.promptFeedback.blockReason})${
          parsed.promptFeedback.blockReasonMessage
            ? `: ${parsed.promptFeedback.blockReasonMessage}`
            : ''
        }`,
        422,
        'CONTENT_BLOCKED'
      );
    }

    const images: GeneratedImageOutput[] = [];
    const textNotes: string[] = [];

    for (const candidate of parsed?.candidates ?? []) {
      const candidateParts = candidate?.content?.parts ?? [];
      for (const part of candidateParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          const rawData = part.inlineData.data;
          const dataUrl = rawData.startsWith('data:')
            ? rawData
            : `data:${mime};base64,${rawData}`;
          images.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl,
            mimeType: mime,
          });
        } else if (part.text) {
          textNotes.push(part.text);
        }
      }
    }

    const combinedNote = textNotes.join(' ').trim() || undefined;
    if (images.length === 0) {
      const finishReason = parsed?.candidates?.[0]?.finishReason;
      throw new ImageGenerationError(
        combinedNote ||
          (finishReason
            ? `Model "${model}" returned no inlineData image (finishReason: ${finishReason}).`
            : `Model "${model}" did not return any inlineData image parts.`),
        422,
        'NO_IMAGE_RETURNED'
      );
    }

    return { images, textNote: combinedNote };
  }

  private static googleQuotaCooldownUntil = 0;
  private static pollinationsCooldownUntil = 0;

  private async refinePromptForDiffusion(
    apiKey: string | null,
    prompt: string,
    style: string | undefined,
    referenceImage?: ReferenceImageInput,
    signal?: AbortSignal
  ): Promise<string> {
    const baseStyled = buildStyledPrompt(prompt, style);
    if (!apiKey) return baseStyled;

    const needsTranslationOrExpansion =
      Boolean(referenceImage) ||
      prompt.trim().length < 45 ||
      /[\u0600-\u06FF]|\b(ek|ka|ki|ke|mein|par|per|aur|khubsurat|tasveer|banao|wala|wali|shair|sher|samundar|pahar|raat|subah|larka|larki|ghar)\b/i.test(
        prompt
      );

    if (!needsTranslationOrExpansion) return baseStyled;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const onOuterAbort = () => controller.abort();
      signal?.addEventListener('abort', onOuterAbort);

      try {
        const parts: Array<
          | { text: string }
          | { inlineData: { mimeType: string; data: string } }
        > = [];
        if (referenceImage) {
          parts.push({
            inlineData: {
              mimeType: referenceImage.mimeType,
              data: referenceImage.data,
            },
          });
        }
        parts.push({
          text: `Convert the user's request into a single vivid, detailed English image-generation prompt (max 55 words). Translate Roman Urdu or Urdu accurately if present. If a reference image is provided, incorporate its key visual subject, colors, and style. Output ONLY the prompt text.\nUser request: "${prompt.trim()}"\nStyle: ${style || 'Photorealistic, crisp detail'}`,
        });

        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
              'User-Agent': 'aistudio-build',
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 120 },
            }),
            signal: controller.signal,
          }
        );
        if (res.ok) {
          const d = (await res.json()) as GeminiRestResponse;
          const refined = d?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || '')
            .join(' ')
            .trim();
          if (refined && refined.length > 8) {
            return style && STYLE_MODIFIERS[style]
              ? `${refined}. ${STYLE_MODIFIERS[style]}`
              : refined;
          }
        }
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onOuterAbort);
      }
    } catch {
      // Fallback safely to base styled prompt
    }
    return baseStyled;
  }

  private getDiffusionDimensions(
    aspectRatio: ImageAspectRatio,
    forHorde: boolean
  ): { width: number; height: number } {
    if (forHorde) {
      // Multiples of 64 within anonymous AI Horde limits
      switch (aspectRatio) {
        case '16:9':
          return { width: 768, height: 448 };
        case '9:16':
          return { width: 448, height: 768 };
        case '4:3':
          return { width: 640, height: 512 };
        case '1:1':
        default:
          return { width: 576, height: 576 };
      }
    }
    switch (aspectRatio) {
      case '16:9':
        return { width: 896, height: 512 };
      case '9:16':
        return { width: 512, height: 896 };
      case '4:3':
        return { width: 768, height: 576 };
      case '1:1':
      default:
        return { width: 768, height: 768 };
    }
  }

  private async generateViaPollinations(
    prompt: string,
    aspectRatio: ImageAspectRatio,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse | null> {
    if (Date.now() < GeminiImageProvider.pollinationsCooldownUntil) {
      return null;
    }

    const { width, height } = this.getDiffusionDimensions(aspectRatio, false);
    const seed = Math.floor(Math.random() * 900000) + 10000;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'OffnexAI/1.0' },
        signal: controller.signal,
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.status === 402 || res.status === 429) {
        GeminiImageProvider.pollinationsCooldownUntil = Date.now() + 45000;
        return null;
      }
      if (!res.ok || !ct.startsWith('image/')) {
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 1024) return null;
      const mime = ct.split(';')[0] || 'image/jpeg';
      return {
        images: [
          {
            id: `cloud-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
            mimeType: mime,
          },
        ],
        modelUsed: 'Offnex Cloud AI (Sana Diffusion)',
        provider: 'gemini',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onOuterAbort);
    }
  }

  private async generateViaAIHorde(
    prompt: string,
    aspectRatio: ImageAspectRatio,
    quality: ImageQuality,
    count: number,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse | null> {
    const { width, height } = this.getDiffusionDimensions(aspectRatio, true);
    const headers = {
      'Content-Type': 'application/json',
      apikey: '0000000000',
      'Client-Agent': 'OffnexAI:1.0:offnex',
    };

    try {
      const submitRes = await fetch('https://aihorde.net/api/v2/generate/async', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          params: {
            width,
            height,
            steps: quality === 'high' ? 28 : 22,
            n: count,
            sampler_name: 'k_euler_a',
            cfg_scale: 7,
          },
          nsfw: false,
          censor_nsfw: true,
        }),
        signal,
      });

      if (!submitRes.ok) return null;
      const submitData = (await submitRes.json()) as { id?: string };
      if (!submitData?.id) return null;

      const jobId = submitData.id;
      const deadline = Date.now() + 42000;

      while (Date.now() < deadline) {
        if (signal?.aborted) return null;
        await new Promise((r) => setTimeout(r, 1500));
        const chkRes = await fetch(`https://aihorde.net/api/v2/generate/check/${jobId}`, {
          headers: { 'Client-Agent': 'OffnexAI:1.0:offnex' },
          signal,
        });
        if (!chkRes.ok) continue;
        const chk = (await chkRes.json()) as { done?: boolean; faulted?: boolean };
        if (chk.faulted) return null;
        if (chk.done) {
          const statusRes = await fetch(`https://aihorde.net/api/v2/generate/status/${jobId}`, {
            headers: { 'Client-Agent': 'OffnexAI:1.0:offnex' },
            signal,
          });
          if (!statusRes.ok) return null;
          const statusData = (await statusRes.json()) as {
            generations?: Array<{ img?: string; model?: string; censored?: boolean }>;
          };
          const gens = (statusData.generations || []).filter((g) => g.img && !g.censored);
          if (gens.length === 0) return null;

          const images: GeneratedImageOutput[] = [];
          for (const g of gens) {
            const imgSrc = g.img!;
            if (imgSrc.startsWith('data:')) {
              images.push({
                id: `horde-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                dataUrl: imgSrc,
                mimeType: 'image/webp',
              });
            } else {
              const imgResp = await fetch(imgSrc, { signal });
              if (imgResp.ok) {
                const ct = (imgResp.headers.get('content-type') || 'image/webp').split(';')[0];
                const buf = Buffer.from(await imgResp.arrayBuffer());
                images.push({
                  id: `horde-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  dataUrl: `data:${ct};base64,${buf.toString('base64')}`,
                  mimeType: ct,
                });
              }
            }
          }

          if (images.length === 0) return null;
          const usedModel = gens[0]?.model ? `Offnex Cloud AI (${gens[0].model})` : 'Offnex Cloud AI (SD Diffusion)';
          return {
            images,
            modelUsed: usedModel,
            provider: 'gemini',
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private async generateWithCloudDiffusionFallback(
    apiKey: string | null,
    req: ImageGenerationRequest,
    aspectRatio: ImageAspectRatio,
    quality: ImageQuality,
    count: number,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse> {
    const refinedPrompt = await this.refinePromptForDiffusion(
      apiKey,
      req.prompt,
      req.style,
      req.referenceImage,
      signal
    );

    // 1. Try OpenAI DALL-E 3 if configured
    const openAiProvider = new OpenAIImageProvider();
    if (openAiProvider.isConfigured()) {
      try {
        const fallbackRes = await openAiProvider.generate(req, signal);
        return fallbackRes;
      } catch (openAiErr) {
        console.warn('[ImageGen Fallback] OpenAI fallback unavailable:', openAiErr);
      }
    }

    // 2. Try Local SD if available
    const localProvider = new LocalSDImageProvider();
    const localStatus = await localProvider.getStatus();
    if (localStatus.available) {
      try {
        return await localProvider.generate(req, signal);
      } catch (localErr) {
        console.warn('[ImageGen Fallback] Local SD fallback unavailable:', localErr);
      }
    }

    // 3. Try Pollinations Sana Diffusion (ultra-fast ~2-4s for single image)
    if (count === 1) {
      const polRes = await this.generateViaPollinations(refinedPrompt, aspectRatio, signal);
      if (polRes && polRes.images.length > 0) {
        return polRes;
      }
    }

    // 4. Try AI Horde Distributed Stable Diffusion (supports count 1..4 & all aspect ratios)
    const hordeRes = await this.generateViaAIHorde(refinedPrompt, aspectRatio, quality, count, signal);
    if (hordeRes && hordeRes.images.length > 0) {
      return hordeRes;
    }

    throw new ImageGenerationError(
      'Cloud image generation is temporarily busy. Please try again in a moment.',
      503,
      'CLOUD_IMAGE_UNAVAILABLE'
    );
  }

  private async extractPinterestSearchQuery(
    apiKey: string | null,
    prompt: string,
    style: string | undefined,
    signal?: AbortSignal
  ): Promise<string> {
    const trimmed = prompt.trim();
    if (/^https?:\/\/(www\.)?(pinterest\.com|pin\.it)\//i.test(trimmed)) {
      return trimmed;
    }

    const styleHint =
      style && style !== 'Realistic Photography' ? ` ${style.replace(/Graphics|Rendering/gi, '').trim()}` : '';

    if (apiKey) {
      const needsCleanup =
        trimmed.length > 50 ||
        /[\u0600-\u06FF]|\b(ek|ka|ki|ke|mein|par|per|aur|khubsurat|tasveer|tasweer|banao|dikhao|chahiye|wala|wali|shair|sher|samundar|pahar|raat|subah|larka|larki|ghar|gadi|kapde|generate|create|show me|image of|picture of|photo of)\b/i.test(
          trimmed
        );

      if (needsCleanup) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const onOuterAbort = () => controller.abort();
          signal?.addEventListener('abort', onOuterAbort);

          try {
            const res = await fetch(
              'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey,
                  'User-Agent': 'aistudio-build',
                },
                body: JSON.stringify({
                  contents: [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: `Extract a concise 2-6 word English Pinterest visual search query from this image request. Translate Roman Urdu/Urdu if present. Output ONLY the search keywords, nothing else.\nRequest: "${trimmed}"${style && style !== 'Realistic Photography' ? `\nStyle: ${style}` : ''}`,
                        },
                      ],
                    },
                  ],
                  generationConfig: { temperature: 0.2, maxOutputTokens: 32 },
                }),
                signal: controller.signal,
              }
            );
            if (res.ok) {
              const d = (await res.json()) as GeminiRestResponse;
              const q = d?.candidates?.[0]?.content?.parts
                ?.map((p) => p.text || '')
                .join(' ')
                .replace(/["'\n]/g, ' ')
                .trim();
              if (q && q.length >= 2) {
                return q;
              }
            }
          } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onOuterAbort);
          }
        } catch {
          // Fallback safely to raw normalized prompt
        }
      }
    }

    return `${trimmed}${styleHint}`.trim();
  }

  private async tryPinterestFirst(
    apiKey: string | null,
    req: ImageGenerationRequest,
    count: number,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse | null> {
    if (req.referenceImage) {
      return null;
    }

    try {
      const searchQuery = await this.extractPinterestSearchQuery(
        apiKey,
        req.prompt,
        req.style,
        signal
      );

      let pins =
        req.pinterestToken &&
        /^(my pins|saved pins|my saved|mere pins)$/i.test(req.prompt.trim())
          ? await fetchPinterestUserPins(req.pinterestToken, undefined, Math.max(6, count * 2))
          : [];

      if (pins.length === 0) {
        pins = await searchPublicPinterestPins(searchQuery, Math.max(8, count * 3), signal);
      }

      if (pins.length === 0) {
        return null;
      }

      const collected: GeneratedImageOutput[] = [];
      for (const pin of pins) {
        if (collected.length >= count) break;
        if (signal?.aborted) break;
        const fetched = await fetchPinterestImageAsDataUrl(pin.imageUrl, signal);
        if (!fetched) continue;
        collected.push({
          id: pin.id,
          dataUrl: fetched.dataUrl,
          mimeType: fetched.mimeType,
        });
      }

      if (collected.length === 0) {
        return null;
      }

      return {
        images: collected,
        modelUsed: 'Offnex Image Studio',
        provider: 'gemini',
      };
    } catch {
      return null;
    }
  }

  public async generate(
    req: ImageGenerationRequest,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse> {
    const quality: ImageQuality = req.quality === 'high' ? 'high' : 'standard';
    const aspectRatio: ImageAspectRatio = req.aspectRatio || '1:1';
    const count = Math.min(4, Math.max(1, Number(req.count) || 1));
    const model = getConfiguredImageModel(quality);
    const styledPrompt = buildStyledPrompt(req.prompt, req.style);

    const { apiKey: resolvedKey, source: resolvedSource } = resolveImageApiKey();
    const hasGeminiKey = Boolean(resolvedKey && resolvedSource !== 'none');

    // Step 1 (Primary): Check Pinterest FIRST for matching visual images when generating from text/prompts
    const pinterestFirstResult = await this.tryPinterestFirst(resolvedKey, req, count, signal);
    if (pinterestFirstResult && pinterestFirstResult.images.length > 0) {
      return pinterestFirstResult;
    }

    // If Google Gemini image quota is already known exhausted (e.g. free-tier limit: 0),
    // go directly to Real Cloud AI Diffusion without wasting time on a 429 round-trip.
    if (!hasGeminiKey || Date.now() < GeminiImageProvider.googleQuotaCooldownUntil) {
      return this.generateWithCloudDiffusionFallback(
        resolvedKey,
        req,
        aspectRatio,
        quality,
        count,
        signal
      );
    }

    const apiKey = resolvedKey!;
    const keySource = resolvedSource;

    try {
      if (signal?.aborted) {
        throw new ImageGenerationError('Image generation request timed out.', 504, 'TIMEOUT');
      }

      const collectedImages: GeneratedImageOutput[] = [];
      let firstNote: string | undefined;

      const firstResult = await this.generateViaRestGenerateContent(
        apiKey,
        keySource,
        model,
        styledPrompt,
        aspectRatio,
        quality,
        req.referenceImage,
        signal
      );
      collectedImages.push(...firstResult.images);
      firstNote = firstResult.textNote;

      if (collectedImages.length < count) {
        const remaining = count - collectedImages.length;
        const extraTasks = Array.from({ length: remaining }, () =>
          this.generateViaRestGenerateContent(
            apiKey,
            keySource,
            model,
            styledPrompt,
            aspectRatio,
            quality,
            req.referenceImage,
            signal
          )
        );
        const extraResults = await Promise.all(extraTasks);
        for (const extra of extraResults) {
          collectedImages.push(...extra.images);
        }
      }

      return {
        images: collectedImages.slice(0, count),
        modelUsed: model,
        provider: 'gemini',
        textNote: firstNote,
      };
    } catch (err: unknown) {
      if (err instanceof ImageGenerationError) {
        if (err.statusCode === 429 || err.code === 'RESOURCE_EXHAUSTED') {
          GeminiImageProvider.googleQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
          console.warn('[Gemini ImageGen] Google image quota limited (429). Generating real image via Cloud Diffusion...');
          return this.generateWithCloudDiffusionFallback(
            apiKey,
            req,
            aspectRatio,
            quality,
            count,
            signal
          );
        }
        if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 503) {
          return this.generateWithCloudDiffusionFallback(
            apiKey,
            req,
            aspectRatio,
            quality,
            count,
            signal
          );
        }
        throw err;
      }

      const errObj = err as { status?: number; message?: string };
      const msg = errObj?.message || 'Image generation failed.';
      console.warn('[Gemini ImageGen Fallback Notice]', { model, keySource, message: msg });
      return this.generateWithCloudDiffusionFallback(
        apiKey,
        req,
        aspectRatio,
        quality,
        count,
        signal
      );
    }
  }
}

export class LocalSDImageProvider implements ImageProvider {
  public readonly id = 'local' as const;
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || process.env.LOCAL_SD_URL || 'http://127.0.0.1:7860').replace(/\/+$/, '');
  }

  public getEndpoint(): string {
    return this.baseUrl;
  }

  public async getStatus(): Promise<LocalSDStatus> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`, {
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          available: false,
          endpoint: this.baseUrl,
          modelsCount: 0,
          error: `HTTP ${res.status}${body ? `: ${body.slice(0, 140)}` : ''}`,
        };
      }
      const models = (await res.json().catch(() => [])) as unknown[];
      return {
        available: true,
        endpoint: this.baseUrl,
        modelsCount: Array.isArray(models) ? models.length : 0,
      };
    } catch (err: unknown) {
      clearTimeout(id);
      const errObj = err as { name?: string; message?: string; cause?: { code?: string } };
      const code = errObj?.cause?.code || (errObj?.name === 'AbortError' ? 'ETIMEDOUT' : undefined);
      return {
        available: false,
        endpoint: this.baseUrl,
        modelsCount: 0,
        error: code
          ? `${code}: Cannot reach ${this.baseUrl}`
          : errObj?.message || `Cannot reach ${this.baseUrl}`,
      };
    }
  }

  public async isAvailable(): Promise<boolean> {
    const status = await this.getStatus();
    return status.available;
  }

  private getDimensions(aspectRatio: ImageAspectRatio, quality: ImageQuality): { width: number; height: number } {
    const high = quality === 'high';
    switch (aspectRatio) {
      case '16:9':
        return high ? { width: 1024, height: 576 } : { width: 768, height: 432 };
      case '9:16':
        return high ? { width: 576, height: 1024 } : { width: 432, height: 768 };
      case '4:3':
        return high ? { width: 896, height: 672 } : { width: 640, height: 480 };
      case '1:1':
      default:
        return high ? { width: 1024, height: 1024 } : { width: 512, height: 512 };
    }
  }

  public async generate(
    req: ImageGenerationRequest,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse> {
    const status = await this.getStatus();
    if (!status.available) {
      const msg = `Local Stable Diffusion is unreachable at ${this.baseUrl} (${status.error || 'connection refused'}). Start Automatic1111/Forge with --api or switch to Cloud Gemini.`;
      console.warn('[LocalSD ImageGen Notice]', { endpoint: this.baseUrl, error: status.error });
      throw new ImageGenerationError(msg, 503, 'LOCAL_MODEL_UNAVAILABLE', status.error);
    }

    const aspectRatio = req.aspectRatio || '1:1';
    const quality: ImageQuality = req.quality === 'high' ? 'high' : 'standard';
    const count = Math.min(4, Math.max(1, Number(req.count) || 1));
    const { width, height } = this.getDimensions(aspectRatio, quality);
    const styledPrompt = buildStyledPrompt(req.prompt, req.style);

    const endpoint = req.referenceImage
      ? `${this.baseUrl}/sdapi/v1/img2img`
      : `${this.baseUrl}/sdapi/v1/txt2img`;

    const payload: Record<string, unknown> = {
      prompt: styledPrompt,
      width,
      height,
      batch_size: count,
      steps: quality === 'high' ? 30 : 20,
    };

    if (req.referenceImage) {
      payload.init_images = [`data:${req.referenceImage.mimeType};base64,${req.referenceImage.data}`];
      payload.denoising_strength = 0.65;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const msg = `Local Stable Diffusion error (HTTP ${response.status})${errBody ? `: ${errBody.slice(0, 200)}` : ''}`;
      console.warn('[LocalSD ImageGen Notice]', { endpoint, status: response.status, body: errBody.slice(0, 300) });
      throw new ImageGenerationError(msg, response.status, 'LOCAL_GENERATION_FAILED', errBody);
    }

    const data = (await response.json()) as { images?: string[] };
    const rawImages = Array.isArray(data.images) ? data.images : [];
    if (rawImages.length === 0) {
      console.warn('[LocalSD ImageGen Notice]', { endpoint, error: 'Empty images array returned' });
      throw new ImageGenerationError(
        'Local Stable Diffusion did not return any images.',
        500,
        'NO_IMAGE_RETURNED'
      );
    }

    return {
      images: rawImages.slice(0, count).map((b64, idx) => ({
        id: `local-img-${Date.now()}-${idx}`,
        dataUrl: b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`,
        mimeType: 'image/png',
      })),
      modelUsed: 'Local Stable Diffusion',
      provider: 'local',
    };
  }
}

export class PinterestImageProvider implements ImageProvider {
  public readonly id = 'pinterest' as const;

  public async generate(
    req: ImageGenerationRequest,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse> {
    const count = Math.min(4, Math.max(1, Number(req.count) || 1));
    const queryWithStyle =
      req.style && req.style !== 'Realistic Photography'
        ? `${req.prompt.trim()} ${req.style}`
        : req.prompt.trim();

    let pins =
      req.pinterestToken &&
      /^(my pins|saved pins|my saved|mere pins)$/i.test(req.prompt.trim())
        ? await fetchPinterestUserPins(req.pinterestToken, undefined, Math.max(6, count * 2))
        : [];

    let usedOAuth = pins.length > 0;

    if (pins.length === 0) {
      pins = await searchPublicPinterestPins(queryWithStyle, Math.max(8, count * 3), signal);
    }

    if (pins.length === 0 && req.pinterestToken) {
      pins = await fetchPinterestUserPins(req.pinterestToken, undefined, Math.max(6, count * 2));
      usedOAuth = pins.length > 0;
    }

    if (pins.length === 0) {
      throw new ImageGenerationError(
        'No matching Pinterest pins were found for this query. Try another search term or paste a Pinterest Pin URL.',
        404,
        'PINTEREST_NO_RESULTS'
      );
    }

    const collected: GeneratedImageOutput[] = [];
    const pinTitles: string[] = [];

    for (const pin of pins) {
      if (collected.length >= count) break;
      const fetched = await fetchPinterestImageAsDataUrl(pin.imageUrl, signal);
      if (!fetched) continue;
      collected.push({
        id: pin.id,
        dataUrl: fetched.dataUrl,
        mimeType: fetched.mimeType,
      });
      if (pin.title) pinTitles.push(pin.title);
    }

    if (collected.length === 0) {
      throw new ImageGenerationError(
        'Could not download images from Pinterest right now. Please try again.',
        503,
        'PINTEREST_FETCH_FAILED'
      );
    }

    return {
      images: collected,
      modelUsed: usedOAuth ? 'Pinterest Connected Account' : 'Pinterest Visual Discovery',
      provider: 'pinterest',
      textNote: pinTitles[0] ? `Pinterest Pin: ${pinTitles[0]}` : undefined,
    };
  }
}

export function createImageProvider(providerId: ImageProviderId = 'gemini'): ImageProvider {
  if (providerId === 'local') return new LocalSDImageProvider();
  if (providerId === 'openai') return new OpenAIImageProvider();
  if (providerId === 'pinterest') return new PinterestImageProvider();
  return new GeminiImageProvider();
}
