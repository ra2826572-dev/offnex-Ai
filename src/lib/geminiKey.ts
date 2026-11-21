import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const PLACEHOLDER_KEYS = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'MY_IMAGE_GENERATION_API_KEY',
  'YOUR_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'MY_OPENAI_API_KEY',
]);

function readEnvLocal(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const filename of ['.env', '.env.local']) {
    try {
      const envPath = path.join(process.cwd(), filename);
      if (fs.existsSync(envPath)) {
        Object.assign(merged, dotenv.parse(fs.readFileSync(envPath, 'utf8')));
      }
    } catch {
      // ignore unreadable env file
    }
  }
  return merged;
}

function cleanKey(raw: string | undefined): string | null {
  const cleaned = (raw || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!cleaned || PLACEHOLDER_KEYS.has(cleaned)) return null;
  return cleaned;
}

export function resolveGeminiChatApiKey(): {
  apiKey: string | null;
  fallbackApiKey: string | null;
  source: 'GEMINI_API_KEY' | 'IMAGE_GENERATION_API_KEY' | 'none';
} {
  const localEnv = readEnvLocal();
  const candidates: Array<{
    key: string;
    source: 'GEMINI_API_KEY' | 'IMAGE_GENERATION_API_KEY';
  }> = [];

  const pushUnique = (key: string | null, source: 'GEMINI_API_KEY' | 'IMAGE_GENERATION_API_KEY') => {
    if (!key) return;
    if (!candidates.some((c) => c.key === key)) {
      candidates.push({ key, source });
    }
  };

  const localGemini = cleanKey(localEnv.GEMINI_API_KEY);
  const localImage = cleanKey(localEnv.IMAGE_GENERATION_API_KEY);

  if (localGemini || localImage) {
    // Trust explicit local .env.local/.env keys without falling back to stale container env keys
    pushUnique(localGemini, 'GEMINI_API_KEY');
    pushUnique(localImage, 'IMAGE_GENERATION_API_KEY');
  } else {
    // Production / Serverless (Vercel, AI Studio Secrets): read runtime process.env
    pushUnique(cleanKey(process.env.GEMINI_API_KEY), 'GEMINI_API_KEY');
    pushUnique(cleanKey(process.env.IMAGE_GENERATION_API_KEY), 'IMAGE_GENERATION_API_KEY');
  }

  if (candidates.length === 0) {
    return { apiKey: null, fallbackApiKey: null, source: 'none' };
  }

  return {
    apiKey: candidates[0].key,
    fallbackApiKey: candidates[1]?.key || null,
    source: candidates[0].source,
  };
}

export function resolveGeminiImageApiKey(): {
  apiKey: string | null;
  source: 'IMAGE_GENERATION_API_KEY' | 'GEMINI_API_KEY' | 'none';
} {
  const localEnv = readEnvLocal();
  const localImg = cleanKey(localEnv.IMAGE_GENERATION_API_KEY);
  const localGem = cleanKey(localEnv.GEMINI_API_KEY);

  if (localImg) return { apiKey: localImg, source: 'IMAGE_GENERATION_API_KEY' };
  if (localGem) return { apiKey: localGem, source: 'GEMINI_API_KEY' };

  const envImg = cleanKey(process.env.IMAGE_GENERATION_API_KEY);
  if (envImg) return { apiKey: envImg, source: 'IMAGE_GENERATION_API_KEY' };

  const envGem = cleanKey(process.env.GEMINI_API_KEY);
  if (envGem) return { apiKey: envGem, source: 'GEMINI_API_KEY' };

  return { apiKey: null, source: 'none' };
}
