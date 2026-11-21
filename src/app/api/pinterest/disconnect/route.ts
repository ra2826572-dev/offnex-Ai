import { NextResponse } from 'next/server';
import { PINTEREST_COOKIE_NAME } from '@/lib/pinterest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ disconnected: true });
  response.cookies.set(PINTEREST_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 0,
  });
  return response;
}
