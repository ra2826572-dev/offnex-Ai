import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getAdminRuntimeConfig, pushServerLog } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const config = getAdminRuntimeConfig();
  if (config.maintenanceMode) {
    pushServerLog('warn', 'chat', 'Blocked Gemini chat request during Maintenance Mode');
    return NextResponse.json(
      { error: 'Platform is temporarily in maintenance mode.' },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { prompt?: string };
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: config.defaultChatModel || 'gemini-3.8-flash',
      contents: body.prompt || '',
      config: {
        systemInstruction:
          'You are OfflineGPT, a 100% offline private local AI assistant. Respond helpfully and concisely.',
      },
    });

    pushServerLog(
      'info',
      'chat',
      `Generated Gemini response (${config.defaultChatModel})`,
      req.headers.get('x-user-id') || 'user'
    );
    return NextResponse.json({ text: response.text });
  } catch (err: unknown) {
    const error = err as Error;
    pushServerLog('error', 'chat', `Gemini chat failed: ${error.message || 'Unknown error'}`);
    return NextResponse.json(
      { error: error.message || 'Gemini API call failed' },
      { status: 500 }
    );
  }
}
