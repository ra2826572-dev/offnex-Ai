import {
  GeneratedImageItem,
  GeneratedImageRecord,
  ImageAspectRatio,
  ImageQuality,
  ImageStyle,
} from '../types';

export const DAILY_IMAGE_LIMIT = 10;

function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DailyImageQuotaStatus {
  used: number;
  remaining: number;
  limit: number;
  dateKey: string;
}

export function getDailyImageQuota(
  userId?: string,
  imageHistory: GeneratedImageRecord[] = [],
  limit: number = DAILY_IMAGE_LIMIT
): DailyImageQuotaStatus {
  const dateKey = getLocalDateKey();
  const uid = (userId || 'anonymous').trim().toLowerCase();

  let storedUsed = 0;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`offnex_daily_img_usage:${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { date?: string; used?: number };
        if (parsed.date === dateKey && typeof parsed.used === 'number' && parsed.used > 0) {
          storedUsed = Math.floor(parsed.used);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  let historyUsedToday = 0;
  for (const rec of imageHistory) {
    if (rec.createdAt) {
      const recDate = getLocalDateKey(new Date(rec.createdAt));
      if (recDate === dateKey) {
        historyUsedToday += Math.max(1, rec.images?.length || rec.count || 1);
      }
    }
  }

  const used = Math.max(storedUsed, historyUsedToday);
  return {
    used,
    remaining: Math.max(0, limit - used),
    limit,
    dateKey,
  };
}

export function recordDailyImageUsage(userId?: string, count: number = 1): void {
  if (typeof window === 'undefined') return;
  const dateKey = getLocalDateKey();
  const uid = (userId || 'anonymous').trim().toLowerCase();
  const key = `offnex_daily_img_usage:${uid}`;

  let currentUsed = 0;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { date?: string; used?: number };
      if (parsed.date === dateKey && typeof parsed.used === 'number') {
        currentUsed = Math.max(0, Math.floor(parsed.used));
      }
    }
    const nextUsed = currentUsed + Math.max(1, Math.floor(count));
    localStorage.setItem(key, JSON.stringify({ date: dateKey, used: nextUsed }));
  } catch {
    // Ignore storage errors
  }
}

export const IMAGE_STYLES: ImageStyle[] = [
  'Realistic Photography',
  '3D Rendering',
  'Anime',
  'Digital Art',
  'Cinematic',
  'Illustration',
  'Logo Design',
  'Product Photography',
  'Social Media Graphics',
];

export const IMAGE_ASPECT_RATIOS: { value: ImageAspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Landscape' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '4:3', label: '4:3 Classic' },
];

export interface LocalImageStatus {
  available: boolean;
  endpoint: string;
  modelsCount: number;
  error?: string;
}

export interface ImageCapabilities {
  cloudConfigured: boolean;
  keySource?: 'IMAGE_GENERATION_API_KEY' | 'GEMINI_API_KEY' | 'none';
  openaiConfigured: boolean;
  cloudModelStandard: string;
  cloudModelHigh: string;
  localAvailable: boolean;
  localEndpoint?: string;
  localModelsCount?: number;
  localError?: string;
  supportedAspectRatios: ImageAspectRatio[];
  supportedQualities: ImageQuality[];
  maxCount: number;
  quota: {
    remaining: number;
    limit: number;
    resetMs: number;
  };
}

export interface ValidatedReferenceImage {
  data: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  previewUrl: string;
  fileName: string;
}

export async function fetchImageCapabilities(userId?: string): Promise<ImageCapabilities | null> {
  try {
    const res = await fetch('/api/image/capabilities', {
      headers: userId ? { 'x-user-id': userId } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as ImageCapabilities;
  } catch {
    return null;
  }
}

export async function fetchLocalImageStatus(): Promise<LocalImageStatus | null> {
  try {
    const res = await fetch('/api/image/local-status');
    if (!res.ok) return null;
    return (await res.json()) as LocalImageStatus;
  } catch {
    return null;
  }
}

export async function validateAndReadReferenceImage(file: File): Promise<ValidatedReferenceImage> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;
  if (!allowedTypes.includes(file.type as (typeof allowedTypes)[number])) {
    throw new Error('Unsupported reference image format. Please upload a PNG, JPEG, or WebP image.');
  }
  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Reference image is too large. Maximum allowed size is 8 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Could not read reference image data.'));
        return;
      }
      resolve({
        data: base64,
        mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        previewUrl: dataUrl,
        fileName: file.name,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read reference image file.'));
    reader.readAsDataURL(file);
  });
}

export interface GenerateImageParams {
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  count: number;
  provider: 'gemini' | 'local' | 'openai';
  referenceImage?: {
    data: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
  userId?: string;
  offlineStrict?: boolean;
}

export interface GenerateImageApiResponse {
  images: GeneratedImageItem[];
  modelUsed: string;
  provider: 'gemini' | 'local' | 'openai';
  textNote?: string;
  quota?: {
    remaining: number;
    limit: number;
    resetMs: number;
  };
}

export async function generateImageApi(
  params: GenerateImageParams
): Promise<GenerateImageApiResponse> {
  if (!params.prompt.trim()) {
    throw new Error('Please describe the image you want to create.');
  }

  // Honest offline handling: do not pretend cloud generation works offline
  if (params.provider === 'gemini') {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        'Your device is currently offline. Cloud AI image generation requires an internet connection (or switch to a compatible local image model if installed).'
      );
    }
    if (params.offlineStrict) {
      throw new Error(
        'Offline Mode is currently enabled in Settings. Disable Offline Mode to use Cloud AI image generation, or select Local SD if installed.'
      );
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.userId ? { 'x-user-id': params.userId } : {}),
      },
      body: JSON.stringify({
        prompt: params.prompt.trim(),
        style: params.style,
        aspectRatio: params.aspectRatio,
        quality: params.quality,
        count: params.count,
        provider: params.provider,
        referenceImage: params.referenceImage,
        userId: params.userId,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        data = { error: rawText.slice(0, 300) };
      }
    }

    if (!response.ok) {
      const errMsg =
        (typeof data.error === 'string' && data.error) ||
        `Image generation failed (HTTP ${response.status}).`;
      console.error('[ImageService Error]', { status: response.status, code: data.code, error: errMsg });
      throw new Error(errMsg);
    }

    if (!Array.isArray(data.images) || data.images.length === 0) {
      throw new Error('No image was returned by the image generation provider.');
    }

    return data as unknown as GenerateImageApiResponse;
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Image generation request timed out. Please try again with a simpler prompt.');
    }
    console.error('[ImageService Exception]', err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function downloadGeneratedImage(
  dataUrl: string,
  baseFileName: string,
  format: 'png' | 'jpeg'
): Promise<void> {
  const safeName = (baseFileName || 'offnex_ai_image')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 48);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1024;
        canvas.height = img.naturalHeight || 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback direct download
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${safeName}.${format}`;
          a.click();
          resolve();
          return;
        }
        if (format === 'jpeg') {
          ctx.fillStyle = '#0B0B16';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const outputUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.94 : undefined);
        const link = document.createElement('a');
        link.href = outputUrl;
        link.download = `${safeName}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      // Direct fallback
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${safeName}.${format === 'jpeg' ? 'jpg' : 'png'}`;
      link.click();
      resolve();
    };
    img.src = dataUrl;
  });
}
