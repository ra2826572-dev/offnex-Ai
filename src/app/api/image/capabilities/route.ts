import { NextRequest, NextResponse } from 'next/server';
import {
  getConfiguredImageModel,
  LocalSDImageProvider,
  OpenAIImageProvider,
  resolveImageApiKey,
  verifyGeminiImageModelAccess,
} from '@/lib/imageProvider';
import { getRemainingImageQuota } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { apiKey, source: keySource } = resolveImageApiKey();
  const cloudConfigured = Boolean(apiKey);
  const openaiProvider = new OpenAIImageProvider();
  const openaiConfigured = openaiProvider.isConfigured();
  const modelStandard = getConfiguredImageModel('standard');
  const modelHigh = getConfiguredImageModel('high');
  const localProvider = new LocalSDImageProvider();
  const [localStatus, modelAccess] = await Promise.all([
    localProvider.getStatus(),
    apiKey ? verifyGeminiImageModelAccess(apiKey, modelStandard) : Promise.resolve(null),
  ]);
  const userKey =
    req.headers.get('x-user-id') || req.headers.get('x-forwarded-for') || 'anonymous';
  const quota = getRemainingImageQuota(userKey);

  return NextResponse.json({
    cloudConfigured,
    keySource,
    openaiConfigured,
    cloudModelStandard: modelStandard,
    cloudModelHigh: modelHigh,
    modelAccess,
    localAvailable: localStatus.available,
    localEndpoint: localStatus.endpoint,
    localModelsCount: localStatus.modelsCount,
    localError: localStatus.error,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3'],
    supportedQualities: ['standard', 'high'],
    maxCount: 4,
    quota,
  });
}
