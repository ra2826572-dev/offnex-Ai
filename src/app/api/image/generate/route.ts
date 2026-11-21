import { NextRequest, NextResponse } from 'next/server';
import {
  createImageProvider,
  ImageAspectRatio,
  ImageGenerationError,
  ImageProviderId,
  ImageQuality,
  ReferenceImageInput,
} from '@/lib/imageProvider';
import {
  consumeImageQuota,
  getAdminRuntimeConfig,
  getRemainingImageQuota,
  pushServerLog,
} from '@/lib/serverState';
import { getPinterestTokenFromRequest } from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const userKey = String(
    req.headers.get('x-user-id') ||
      body?.userId ||
      req.headers.get('x-forwarded-for') ||
      'anonymous'
  );
  const config = getAdminRuntimeConfig();

  if (config.maintenanceMode) {
    pushServerLog('warn', 'image', 'Blocked image generation during Maintenance Mode', userKey);
    return NextResponse.json(
      {
        error: 'Image generation is paused while platform Maintenance Mode is active.',
        code: 'MAINTENANCE_MODE',
      },
      { status: 503 }
    );
  }

  try {
    const {
      prompt,
      style,
      aspectRatio = '1:1',
      quality = 'standard',
      count = 1,
      referenceImage,
      provider = 'gemini',
    } = body as {
      prompt?: unknown;
      style?: unknown;
      aspectRatio?: ImageAspectRatio;
      quality?: ImageQuality;
      count?: number;
      referenceImage?: { data?: unknown; mimeType?: string };
      provider?: ImageProviderId;
    };

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        {
          error: 'Please enter a description of the image you want to create.',
          code: 'INVALID_PROMPT',
        },
        { status: 400 }
      );
    }
    if (prompt.trim().length > 2000) {
      return NextResponse.json(
        {
          error: 'Image prompt is too long (maximum 2000 characters).',
          code: 'PROMPT_TOO_LONG',
        },
        { status: 400 }
      );
    }

    const allowedRatios: ImageAspectRatio[] = ['1:1', '16:9', '9:16', '4:3'];
    const validRatio: ImageAspectRatio = allowedRatios.includes(aspectRatio) ? aspectRatio : '1:1';
    const validQuality: ImageQuality = quality === 'high' ? 'high' : 'standard';
    const validCount = Math.min(4, Math.max(1, Math.floor(Number(count) || 1)));
    const allowedProviders: ImageProviderId[] = ['gemini', 'local', 'openai', 'pinterest'];
    const validProvider: ImageProviderId = allowedProviders.includes(provider) ? provider : 'gemini';
    const pinterestToken = getPinterestTokenFromRequest(req) || undefined;

    let validReferenceImage: ReferenceImageInput | undefined;
    if (referenceImage) {
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (
        typeof referenceImage.data !== 'string' ||
        !referenceImage.mimeType ||
        !allowedMimeTypes.includes(referenceImage.mimeType)
      ) {
        return NextResponse.json(
          {
            error: 'Invalid reference image. Please upload a PNG, JPEG, or WebP image.',
            code: 'INVALID_REFERENCE_IMAGE',
          },
          { status: 400 }
        );
      }
      const cleanedBase64 = referenceImage.data.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const estimatedBytes = Math.ceil((cleanedBase64.length * 3) / 4);
      if (estimatedBytes > 8 * 1024 * 1024) {
        return NextResponse.json(
          {
            error: 'Reference image exceeds the 8 MB maximum size limit.',
            code: 'REFERENCE_IMAGE_TOO_LARGE',
          },
          { status: 400 }
        );
      }
      validReferenceImage = {
        data: cleanedBase64,
        mimeType: referenceImage.mimeType as ReferenceImageInput['mimeType'],
      };
    }

    const currentQuota = getRemainingImageQuota(userKey);
    if (currentQuota.remaining <= 0) {
      pushServerLog('warn', 'image', `Daily image limit reached for ${userKey}`, userKey);
      return NextResponse.json(
        {
          error: `Daily image limit reached (${currentQuota.limit} images per day). Free AI chat is still unlimited — please generate more images tomorrow.`,
          code: 'DAILY_LIMIT_EXCEEDED',
          quota: currentQuota,
        },
        { status: 429 }
      );
    }
    if (validCount > currentQuota.remaining) {
      return NextResponse.json(
        {
          error: `Only ${currentQuota.remaining} image(s) left in your daily limit (${currentQuota.limit} per day). Please reduce image count to ${currentQuota.remaining}.`,
          code: 'DAILY_LIMIT_EXCEEDED',
          quota: currentQuota,
        },
        { status: 429 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const imageProvider = createImageProvider(validProvider);
      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(
            new ImageGenerationError(
              'Image generation timed out after 60 seconds. Please try again.',
              504,
              'TIMEOUT'
            )
          );
        });
      });

      const result = await Promise.race([
        imageProvider.generate(
          {
            prompt: prompt.trim(),
            style: typeof style === 'string' ? style : undefined,
            aspectRatio: validRatio,
            quality: validQuality,
            count: validCount,
            referenceImage: validReferenceImage,
            provider: validProvider,
            pinterestToken,
          },
          controller.signal
        ),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);
      const updatedQuota = consumeImageQuota(userKey, result.images.length);
      const savedRecordId = `imgrec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        const { saveBackendImageRecord } = await import('@/lib/backendDb');
        const { getRequestUserMeta } = await import('@/lib/requestAuth');
        const meta = getRequestUserMeta(req);
        saveBackendImageRecord({
          id: savedRecordId,
          userId: String(body?.userId || meta.userId || userKey || 'anonymous'),
          userEmail:
            typeof body?.userEmail === 'string' && body.userEmail
              ? body.userEmail
              : meta.userEmail,
          userName:
            typeof body?.userName === 'string' && body.userName
              ? body.userName
              : meta.userName,
          prompt: prompt.trim(),
          style: (typeof style === 'string' ? style : 'Realistic Photography') as import('@/types').ImageStyle,
          aspectRatio: validRatio,
          quality: validQuality,
          count: result.images.length,
          modelUsed: result.modelUsed,
          provider: result.provider,
          images: result.images,
          hasReferenceImage: Boolean(validReferenceImage),
          createdAt: new Date().toISOString(),
        });
      } catch (saveErr) {
        console.warn('[POST /api/image/generate] Backend image save notice:', saveErr);
      }
      pushServerLog(
        'info',
        'image',
        `Generated ${result.images.length} image(s) via ${result.modelUsed}`,
        userKey
      );
      return NextResponse.json({
        ...result,
        savedRecordId,
        quota: {
          remaining: updatedQuota.remaining,
          limit: updatedQuota.limit,
          resetMs: updatedQuota.resetMs,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: unknown) {
    if (err instanceof ImageGenerationError) {
      console.warn('[POST /api/image/generate]', err.statusCode, err.code, err.message);
      pushServerLog('warn', 'image', `Image gen notice (${err.code}): ${err.message}`, userKey);
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: err.details,
          quota: getRemainingImageQuota(userKey),
        },
        { status: err.statusCode }
      );
    }
    const error = err as Error;
    console.warn('[POST /api/image/generate] Unexpected fallback:', error);
    pushServerLog('warn', 'image', `Unexpected image gen notice: ${error.message}`, userKey);
    return NextResponse.json(
      {
        error: error.message || 'Image generation failed unexpectedly.',
        code: 'INTERNAL_ERROR',
        quota: getRemainingImageQuota(userKey),
      },
      { status: 500 }
    );
  }
}
