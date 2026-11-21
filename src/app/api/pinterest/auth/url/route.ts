import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildPinterestOAuthUrl, getPinterestOAuthConfig } from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getPinterestOAuthConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        configured: false,
        callbackUrl: config.callbackUrl,
        error:
          'Pinterest OAuth credentials (PINTEREST_CLIENT_ID & PINTEREST_CLIENT_SECRET) are not configured yet. Public Pinterest image search and Pin URL import are active right now.',
      },
      { status: 200 }
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const url = buildPinterestOAuthUrl(state);

  const response = NextResponse.json({
    configured: true,
    url,
    callbackUrl: config.callbackUrl,
  });

  response.cookies.set('offnex_pinterest_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 600,
  });

  return response;
}
