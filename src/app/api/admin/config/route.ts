import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminRuntimeConfig,
  pushServerLog,
  ServerRuntimeConfig,
  updateAdminRuntimeConfig,
} from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: getAdminRuntimeConfig() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<ServerRuntimeConfig>;
  const updated = updateAdminRuntimeConfig(body);
  pushServerLog('info', 'admin', 'Updated runtime platform configuration', 'admin');
  return NextResponse.json({ ok: true, config: updated });
}
