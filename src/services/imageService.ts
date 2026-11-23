import {
  GeneratedImageItem,
  GeneratedImageRecord,
  ImageAspectRatio,
  ImageQuality,
  ImageStyle,
} from '../types';
import { generateOfflineImages } from './offlineImageEngine';

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
  pinterestReady?: boolean;
  pinterestOAuthConfigured?: boolean;
  pinterestConnected?: boolean;
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
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
  provider: 'gemini' | 'local' | 'openai' | 'pinterest';
  referenceImage?: {
    data: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
  userId?: string;
  userEmail?: string;
  userName?: string;
  offlineStrict?: boolean;
}

export interface GenerateImageApiResponse {
  images: GeneratedImageItem[];
  modelUsed: string;
  provider: 'gemini' | 'local' | 'openai' | 'pinterest';
  textNote?: string;
  savedRecordId?: string;
  quota?: {
    remaining: number;
    limit: number;
    resetMs: number;
  };
}

export interface PinterestPinItemClient {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl: string;
  pinUrl: string;
  author?: string;
  boardName?: string;
  width?: number;
  height?: number;
  source: string;
}

export interface PinterestBoardClient {
  id: string;
  name: string;
  description?: string;
  pinCount?: number;
  imageThumbnailUrl?: string;
}

export interface PinterestStatusResponse {
  oauthConfigured: boolean;
  connected: boolean;
  callbackUrl: string;
  user: {
    username: string;
    businessName?: string;
    profileImage?: string;
  } | null;
  boards: PinterestBoardClient[];
  pins: PinterestPinItemClient[];
}

export function getProxiedPinterestImageUrl(rawUrl: string): string {
  return `/api/pinterest/image?url=${encodeURIComponent(rawUrl)}`;
}

export async function fetchPinterestStatus(): Promise<PinterestStatusResponse | null> {
  try {
    const res = await fetch('/api/pinterest/status');
    if (!res.ok) return null;
    return (await res.json()) as PinterestStatusResponse;
  } catch {
    return null;
  }
}

export async function searchPinterestPinsApi(
  query: string,
  boardId?: string,
  limit: number = 18
): Promise<{ pins: PinterestPinItemClient[]; source?: string; connected?: boolean; error?: string }> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (boardId) params.set('boardId', boardId);
  params.set('limit', String(limit));
  const res = await fetch(`/api/pinterest/search?${params.toString()}`);
  const data = (await res.json().catch(() => ({ pins: [] }))) as {
    pins?: PinterestPinItemClient[];
    source?: string;
    connected?: boolean;
    error?: string;
  };
  return {
    pins: Array.isArray(data.pins) ? data.pins : [],
    source: data.source,
    connected: data.connected,
    error: data.error,
  };
}

export async function fetchPinterestAuthUrl(): Promise<{
  configured: boolean;
  url?: string;
  callbackUrl?: string;
  error?: string;
}> {
  const res = await fetch('/api/pinterest/auth/url');
  return (await res.json()) as {
    configured: boolean;
    url?: string;
    callbackUrl?: string;
    error?: string;
  };
}

export async function disconnectPinterestAccount(): Promise<boolean> {
  try {
    const res = await fetch('/api/pinterest/disconnect', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pinterestImageUrlToReference(
  imageUrl: string,
  title: string
): Promise<ValidatedReferenceImage> {
  const res = await fetch(getProxiedPinterestImageUrl(imageUrl));
  if (!res.ok) {
    throw new Error('Could not load Pinterest image as reference.');
  }
  const blob = await res.blob();
  const rawType = (blob.type || 'image/jpeg').toLowerCase();
  const mimeType: 'image/png' | 'image/jpeg' | 'image/webp' =
    rawType === 'image/png'
      ? 'image/png'
      : rawType === 'image/webp'
      ? 'image/webp'
      : 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Could not encode Pinterest image.'));
        return;
      }
      resolve({
        data: base64,
        mimeType,
        previewUrl: dataUrl,
        fileName: `${(title || 'pinterest_pin').slice(0, 28)}.${mimeType.split('/')[1]}`,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read Pinterest image.'));
    reader.readAsDataURL(blob);
  });
}

export async function generateImageApi(
  params: GenerateImageParams
): Promise<GenerateImageApiResponse> {
  if (!params.prompt.trim()) {
    throw new Error('Please describe the image you want to create.');
  }

  const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseOfflineStudio =
    Boolean(params.offlineStrict) ||
    isBrowserOffline;

  const renderOnDeviceFallback = async (reasonNote: string): Promise<GenerateImageApiResponse> => {
    const localImages = await generateOfflineImages({
      prompt: params.prompt.trim(),
      style: params.style,
      aspectRatio: params.aspectRatio,
      quality: params.quality,
      count: params.count,
      referenceImage: params.referenceImage,
    });
    if (localImages.length === 0) {
      throw new Error('Could not generate image on this device.');
    }
    return {
      images: localImages,
      modelUsed: 'Offnex Studio (On-Device)',
      provider: 'local',
      textNote: reasonNote,
    };
  };

  // Run full on-device Offline Image Studio cleanly when offlineStrict is enabled or network is down
  if (shouldUseOfflineStudio && params.provider !== 'local') {
    return renderOnDeviceFallback('Generated 100% offline on your device (No internet required).');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.userId ? { 'x-user-id': params.userId } : {}),
        ...(params.userEmail ? { 'x-user-email': params.userEmail } : {}),
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
        userEmail: params.userEmail,
        userName: params.userName,
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
      const code = typeof data.code === 'string' ? data.code : '';
      const errMsg =
        (typeof data.error === 'string' && data.error) ||
        `Image generation failed (HTTP ${response.status}).`;

      // Respect explicit input validation / daily app quota / safety filter blocks
      if (
        code === 'DAILY_LIMIT_EXCEEDED' ||
        code === 'INVALID_PROMPT' ||
        code === 'PROMPT_TOO_LONG' ||
        code === 'INVALID_REFERENCE_IMAGE' ||
        code === 'REFERENCE_IMAGE_TOO_LARGE' ||
        code === 'CONTENT_BLOCKED'
      ) {
        throw new Error(errMsg);
      }

      // When Google Cloud free-tier quota (429 limit:0), API key, or Local SD is unavailable,
      // seamlessly render via Offnex On-Device Studio instead of failing!
      console.warn('[ImageService Fallback]', { status: response.status, code, reason: errMsg });
      return await renderOnDeviceFallback('Cloud image service busy — generated via Offnex On-Device Studio.');
    }

    if (!Array.isArray(data.images) || data.images.length === 0) {
      return await renderOnDeviceFallback('Generated via Offnex On-Device Studio.');
    }

    return data as unknown as GenerateImageApiResponse;
  } catch (err: unknown) {
    const errObj = err as Error;
    if (errObj?.name === 'AbortError' || err instanceof TypeError || isBrowserOffline) {
      console.warn('[ImageService Network/Timeout Fallback]', errObj?.message || err);
      return renderOnDeviceFallback('Generated via Offnex On-Device Studio.');
    }
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
