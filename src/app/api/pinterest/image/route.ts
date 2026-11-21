import { NextRequest, NextResponse } from 'next/server';
import { isAllowedPinterestImageUrl } from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = (searchParams.get('url') || '').trim();

  if (!rawUrl || !isAllowedPinterestImageUrl(rawUrl)) {
    return NextResponse.json(
      { error: 'Invalid or non-Pinterest image URL.' },
      { status: 400 }
    );
  }

  const candidates = [rawUrl];
  if (rawUrl.includes('/736x/')) {
    candidates.push(rawUrl.replace('/736x/', '/474x/'));
    candidates.push(rawUrl.replace('/736x/', '/236x/'));
  }

  for (const candidate of candidates) {
    try {
      const upstream = await fetch(candidate, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Referer: 'https://www.pinterest.com/',
        },
        signal: req.signal,
      });
      if (!upstream.ok) continue;
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!contentType.toLowerCase().startsWith('image/')) continue;
      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength < 256) continue;

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      // Try next lower resolution fallback
    }
  }

  return NextResponse.json({ error: 'Unable to fetch Pinterest image.' }, { status: 404 });
}
