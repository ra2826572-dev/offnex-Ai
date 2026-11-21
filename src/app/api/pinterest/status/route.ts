import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPinterestUserAccount,
  fetchPinterestUserBoards,
  fetchPinterestUserPins,
  getPinterestOAuthConfig,
  getPinterestTokenFromRequest,
} from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const oauthConfig = getPinterestOAuthConfig();
  const token = getPinterestTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({
      oauthConfigured: oauthConfig.configured,
      connected: false,
      callbackUrl: oauthConfig.callbackUrl,
      user: null,
      boards: [],
      pins: [],
    });
  }

  const [user, boards, pins] = await Promise.all([
    fetchPinterestUserAccount(token),
    fetchPinterestUserBoards(token, 20),
    fetchPinterestUserPins(token, undefined, 16),
  ]);

  if (!user) {
    return NextResponse.json({
      oauthConfigured: oauthConfig.configured,
      connected: false,
      callbackUrl: oauthConfig.callbackUrl,
      user: null,
      boards: [],
      pins: [],
    });
  }

  return NextResponse.json({
    oauthConfigured: oauthConfig.configured,
    connected: true,
    callbackUrl: oauthConfig.callbackUrl,
    user,
    boards,
    pins,
  });
}
