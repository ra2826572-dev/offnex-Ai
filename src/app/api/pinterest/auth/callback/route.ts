import { NextRequest, NextResponse } from 'next/server';
import {
  exchangePinterestCodeForToken,
  PINTEREST_COOKIE_NAME,
} from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function htmlResponse(title: string, script: string, bodyText: string, status = 200) {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#0B0B16;color:#E2E8F0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
  <div style="max-width:420px;background:#14172B;border:1px solid #2A2F4F;border-radius:16px;padding:24px;">
    <h2 style="margin:0 0 8px;font-size:18px;">${title}</h2>
    <p style="margin:0;font-size:13px;color:#94A3B8;">${bodyText}</p>
  </div>
  <script>${script}</script>
</body>
</html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return htmlResponse(
      'Pinterest Connection Cancelled',
      `if (window.opener) {
        window.opener.postMessage({ type: 'PINTEREST_OAUTH_ERROR', error: ${JSON.stringify(error)} }, '*');
        window.close();
      }`,
      `Pinterest authorization returned: ${error}. You can close this window.`,
      400
    );
  }

  if (!code) {
    return htmlResponse(
      'Missing Authorization Code',
      `if (window.opener) {
        window.opener.postMessage({ type: 'PINTEREST_OAUTH_ERROR', error: 'Missing code parameter' }, '*');
        window.close();
      }`,
      'Pinterest did not return an authorization code. Please try connecting again.',
      400
    );
  }

  try {
    const tokens = await exchangePinterestCodeForToken(code);
    const response = htmlResponse(
      'Pinterest Connected!',
      `if (window.opener) {
        window.opener.postMessage({ type: 'PINTEREST_OAUTH_SUCCESS' }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }`,
      'Your Pinterest account is now connected to Offnex AI. Closing this window...'
    );

    response.cookies.set(PINTEREST_COOKIE_NAME, tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: tokens.expires_in && tokens.expires_in > 0 ? tokens.expires_in : 60 * 60 * 24 * 28,
    });
    response.cookies.delete('offnex_pinterest_oauth_state');
    return response;
  } catch (err: unknown) {
    const message = (err as Error)?.message || 'Token exchange failed';
    return htmlResponse(
      'Pinterest Connection Failed',
      `if (window.opener) {
        window.opener.postMessage({ type: 'PINTEREST_OAUTH_ERROR', error: ${JSON.stringify(message)} }, '*');
      }`,
      message,
      500
    );
  }
}
