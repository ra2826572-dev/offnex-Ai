import { NextRequest, NextResponse } from 'next/server';
import { getBackendLiveSyncSnapshot } from '@/lib/backendDb';
import { getRequestUserMeta } from '@/lib/requestAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const meta = getRequestUserMeta(req);
  const userId = searchParams.get('userId')?.trim() || meta.userId || undefined;
  const email = searchParams.get('email')?.trim() || meta.userEmail || undefined;

  const snapshot = getBackendLiveSyncSnapshot({ userId, email });

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
