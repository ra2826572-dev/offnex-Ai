import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPinterestUserPins,
  getPinterestTokenFromRequest,
  searchPublicPinterestPins,
} from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').trim();
  const boardId = (searchParams.get('boardId') || '').trim();
  const limit = Math.min(30, Math.max(1, Number(searchParams.get('limit')) || 18));

  const token = getPinterestTokenFromRequest(req);

  try {
    // If a specific OAuth board or personal pins feed is requested
    if (token && (boardId || query.toLowerCase() === 'my pins' || query.toLowerCase() === 'saved')) {
      const oauthPins = await fetchPinterestUserPins(token, boardId || undefined, limit);
      if (oauthPins.length > 0) {
        return NextResponse.json({
          pins: oauthPins,
          source: 'pinterest_oauth',
          connected: true,
          query,
        });
      }
    }

    const pins = await searchPublicPinterestPins(query, limit, req.signal);
    return NextResponse.json({
      pins,
      source: query ? 'pinterest_search' : 'pinterest_ideas',
      connected: Boolean(token),
      query,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        pins: [],
        error: (err as Error)?.message || 'Could not fetch Pinterest pins right now.',
        connected: Boolean(token),
      },
      { status: 500 }
    );
  }
}
