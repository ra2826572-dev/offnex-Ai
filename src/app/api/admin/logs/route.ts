import { NextResponse } from 'next/server';
import { clearServerLogs, getServerLogs } from '@/lib/serverState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ logs: getServerLogs() });
}

export async function DELETE() {
  const logs = clearServerLogs();
  return NextResponse.json({ ok: true, logs });
}
