import { NextRequest, NextResponse } from 'next/server';
import {
  createUserByAdminBackend,
  deleteUserByAdminBackend,
  listBackendUsers,
  updateUserByAdminBackend,
} from '@/lib/backendDb';
import { isTrustedSameOrigin } from '@/lib/requestAuth';
import type { UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ users: listBackendUsers() });
}

export async function POST(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ success: false, error: 'Untrusted origin.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: UserRole;
    password?: string;
  };

  const result = createUserByAdminBackend({
    firstName: body.firstName || '',
    lastName: body.lastName || '',
    email: body.email || '',
    role: body.role === 'business_owner' ? 'business_owner' : 'user',
    password: body.password,
  });

  if (!result.ok || !result.user) {
    return NextResponse.json(
      { success: false, error: result.error || 'Failed to create user.' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    user: result.user,
    users: listBackendUsers(),
  });
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: UserRole;
  };

  if (!body.id) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  const updated = updateUserByAdminBackend(body.id, {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    role: body.role,
  });

  if (!updated) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: updated,
    users: listBackendUsers(),
  });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedSameOrigin(req)) {
    return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  deleteUserByAdminBackend(id);
  return NextResponse.json({ ok: true, users: listBackendUsers() });
}
