import { NextRequest, NextResponse } from 'next/server';
import {
  appendBackendLog,
  createAdminSessionToken,
  updateAdminPasscode,
  verifyAdminPasscode,
  verifyAdminSessionToken,
} from '@/lib/backendDb';
import { isTrustedSameOrigin } from '@/lib/requestAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_SESSION_COOKIE = 'offnex_admin_session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const authenticated = verifyAdminSessionToken(token);
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';

  if (!verifyAdminPasscode(password)) {
    appendBackendLog('warn', 'admin', 'Failed Admin Panel password attempt', 'admin', 'server');
    return NextResponse.json(
      { ok: false, error: 'Incorrect admin password.' },
      { status: 401 }
    );
  }

  const token = createAdminSessionToken();
  appendBackendLog('info', 'admin', 'Admin Panel unlocked via password', 'admin', 'server');

  const res = NextResponse.json({ ok: true, authenticated: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const result = updateAdminPasscode(
    body.currentPassword || '',
    body.newPassword || ''
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, authenticated: false });
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  return res;
}
