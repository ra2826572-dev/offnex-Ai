import { NextRequest, NextResponse } from 'next/server';
import {
  resetBackendUserPassword,
  upsertUserAuthSync,
} from '@/lib/backendDb';
import { isTrustedSameOrigin } from '@/lib/requestAuth';
import type { UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ success: false, error: 'Untrusted origin.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: 'login' | 'register' | 'sync' | 'resetPassword';
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: UserRole;
    password?: string;
    newPassword?: string;
    avatarUrl?: string;
  };

  if (body.action === 'resetPassword') {
    if (!body.email || !body.newPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and new password are required.' },
        { status: 400 }
      );
    }
    const res = resetBackendUserPassword(body.email, body.newPassword);
    if (!res.ok) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Email is required.' },
      { status: 400 }
    );
  }

  const result = upsertUserAuthSync({
    id: body.id,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    role: body.role,
    password: body.password,
    avatarUrl: body.avatarUrl,
    mode:
      body.action === 'register'
        ? 'register'
        : body.action === 'login'
        ? 'login'
        : 'sync',
  });

  if (!result.ok || !result.user) {
    return NextResponse.json(
      { success: false, error: result.error || 'Authentication failed.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, user: result.user });
}
