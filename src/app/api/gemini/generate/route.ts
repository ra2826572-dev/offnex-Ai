import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Content } from '@google/genai';
import { getAdminRuntimeConfig, pushServerLog } from '@/lib/serverState';
import { resolveGeminiChatApiKey } from '@/lib/geminiKey';
import { DocumentChunk, SupportedLanguage } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GeminiRequestContext {
  history?: { role: 'user' | 'assistant'; content: string }[];
  documentChunks?: DocumentChunk[];
  language?: SupportedLanguage;
  temperature?: number;
}

function normalizeChatModel(model?: string): string {
  const m = (model || '').trim();
  if (
    !m ||
    m === 'gemini-1.5-flash' ||
    m === 'gemini-1.5-pro' ||
    m === 'gemini-pro' ||
    m === 'gemini-2.0-flash' ||
    m === 'gemini-2.0-pro' ||
    m === 'gemini-3.8-flash'
  ) {
    return 'gemini-3.1-flash-lite';
  }
  return m;
}

export async function POST(req: NextRequest) {
  const config = getAdminRuntimeConfig();
  if (config.maintenanceMode) {
    pushServerLog('warn', 'chat', 'Blocked Gemini chat request during Maintenance Mode');
    return NextResponse.json(
      { error: 'Platform is temporarily in maintenance mode.', code: 'MAINTENANCE' },
      { status: 503 }
    );
  }

  const { apiKey, fallbackApiKey } = resolveGeminiChatApiKey();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Gemini API key is not configured. Please set GEMINI_API_KEY in the Settings > Secrets panel.',
        code: 'API_KEY_INVALID',
      },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as {
      prompt?: string;
      model?: string;
      context?: GeminiRequestContext;
    };

    const userPrompt = (body.prompt || '').trim();
    if (!userPrompt) {
      return NextResponse.json({ error: 'Prompt is required.', code: 'BAD_REQUEST' }, { status: 400 });
    }

    const activeModel = normalizeChatModel(body.model || config.defaultChatModel);
    const context = body.context || {};
    const chunks = Array.isArray(context.documentChunks) ? context.documentChunks : [];
    const history = Array.isArray(context.history) ? context.history.slice(-20) : [];

    const contents: Content[] = [];
    for (const turn of history) {
      const text = (turn.content || '').trim();
      if (!text) continue;
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }

    let finalUserMessage = userPrompt;
    if (chunks.length > 0) {
      const docsContext = chunks
        .slice(0, 6)
        .map((c, idx) => `[Excerpt ${idx + 1} - Page ${c.pageNumber}]: ${c.text}`)
        .join('\n\n');
      finalUserMessage = `Use the attached document excerpts when relevant to answer the user's question:\n\n${docsContext}\n\nUser Question: ${userPrompt}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: finalUserMessage }],
    });

    const langHint =
      context.language === 'ur'
        ? 'Respond naturally in Urdu unless the user writes in another language (e.g. English or Roman Urdu), in which case match the user message language.'
        : context.language === 'roman_ur'
        ? 'Respond naturally in Roman Urdu unless the user writes in English or Urdu script, in which case match the user message language.'
        : 'Respond in the exact same language and script as the user message.';

    const genConfig = {
      systemInstruction: `You are Offnex AI, a versatile, intelligent, and helpful AI assistant.
Answer ANY question or request accurately, clearly, and thoroughly across all domains: general knowledge, science, math, coding & debugging, history, writing, translation, brainstorming, business, study help, and uploaded documents.
${langHint}
Format explanations cleanly with headings, bullet points, or code blocks whenever helpful.`,
    };

    const callModelWithKey = async (key: string, modelName: string, timeoutMs: number) => {
      const client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      let timerId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
        });
        const resp = await Promise.race([
          client.models.generateContent({
            model: modelName,
            contents,
            config: genConfig,
          }),
          timeoutPromise,
        ]);
        return (resp.text || '').trim();
      } finally {
        if (timerId) clearTimeout(timerId);
      }
    };

    const keysToTry = [apiKey, ...(fallbackApiKey && fallbackApiKey !== apiKey ? [fallbackApiKey] : [])];
    const attemptQueue: Array<{ model: string; timeoutMs: number; delayMs: number }> =
      activeModel === 'gemini-3.1-flash-lite'
        ? [
            { model: 'gemini-3.1-flash-lite', timeoutMs: 15000, delayMs: 0 },
            { model: 'gemini-3.1-flash-lite', timeoutMs: 15000, delayMs: 450 },
            { model: 'gemini-4-hydrogen', timeoutMs: 10000, delayMs: 0 },
          ]
        : [
            { model: activeModel, timeoutMs: 10000, delayMs: 0 },
            { model: 'gemini-3.1-flash-lite', timeoutMs: 15000, delayMs: 0 },
            { model: 'gemini-3.1-flash-lite', timeoutMs: 15000, delayMs: 450 },
          ];

    let usedModel = activeModel;
    let replyText = '';
    let lastError: unknown = null;

    outer: for (const candidateKey of keysToTry) {
      for (const step of attemptQueue) {
        if (step.delayMs > 0) {
          await new Promise((r) => setTimeout(r, step.delayMs));
        }
        try {
          replyText = await callModelWithKey(candidateKey, step.model, step.timeoutMs);
          usedModel = step.model;
          if (replyText) break outer;
        } catch (err: unknown) {
          lastError = err;
          const rawErr = (err as { message?: string })?.message || String(err);
          const msg = rawErr.toLowerCase();
          const isKeyErr =
            msg.includes('api key not valid') ||
            msg.includes('api_key_invalid') ||
            msg.includes('unauthenticated') ||
            msg.includes('permission_denied') ||
            msg.includes('401') ||
            msg.includes('403');
          if (isKeyErr) {
            continue outer;
          }
          const isTransient =
            msg.includes('503') ||
            msg.includes('504') ||
            msg.includes('500') ||
            msg.includes('deadline') ||
            msg.includes('unavailable') ||
            msg.includes('high demand') ||
            msg.includes('overloaded') ||
            msg.includes('timeout') ||
            msg.includes('aborted') ||
            msg.includes('not_found') ||
            msg.includes('404');
          if (!isTransient) {
            throw err;
          }
        }
      }
      // If a valid key hit only transient model/network errors (not key auth error), do not fall back to another key
      if (lastError) {
        throw lastError;
      }
    }

    if (!replyText && lastError) {
      throw lastError;
    }

    if (!replyText) {
      return NextResponse.json(
        { error: 'Model returned an empty response. Please try rephrasing your question.', code: 'EMPTY' },
        { status: 502 }
      );
    }

    pushServerLog(
      'info',
      'chat',
      `Generated Gemini response (${usedModel})`,
      req.headers.get('x-user-id') || 'user'
    );

    return NextResponse.json({ text: replyText, model: usedModel });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    const rawMessage = error?.message || 'Gemini API call failed';
    const lower = rawMessage.toLowerCase();

    let status = 500;
    let code = 'SERVER_ERROR';
    let cleanMessage = rawMessage;

    if (
      lower.includes('api key not valid') ||
      lower.includes('api_key_invalid') ||
      lower.includes('unauthenticated') ||
      lower.includes('permission_denied') ||
      lower.includes('401') ||
      lower.includes('403')
    ) {
      status = 401;
      code = 'API_KEY_INVALID';
      cleanMessage =
        'Gemini API key is missing or invalid. Please check or select a valid GEMINI_API_KEY in the Settings > Secrets panel.';
    } else if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
      status = 429;
      code = 'RESOURCE_EXHAUSTED';
      cleanMessage =
        'Gemini API rate limit or quota reached. Please wait a moment or check your API key tier in Settings > Secrets.';
    } else if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('504') ||
      lower.includes('deadline') ||
      lower.includes('timeout')
    ) {
      status = 503;
      code = 'SERVICE_UNAVAILABLE';
      cleanMessage = 'Gemini model is temporarily busy due to high demand. Please send your message again in a moment.';
    } else if (lower.includes('not_found') || lower.includes('404')) {
      status = 404;
      code = 'NOT_FOUND';
      cleanMessage = 'Selected Gemini model was not found. Please switch to gemini-3.1-flash-lite in Admin Panel.';
    }

    pushServerLog('error', 'chat', `Gemini chat failed (${code}): ${cleanMessage}`);
    return NextResponse.json({ error: cleanMessage, code }, { status });
  }
}
