import { NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const totalMem = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
  const freeMem = Math.round((os.freemem() / (1024 * 1024 * 1024)) * 10) / 10;
  const cpus = os.cpus();

  return NextResponse.json({
    platform: os.platform(),
    arch: os.arch(),
    totalMemGb: totalMem,
    freeMemGb: freeMem,
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model || 'Generic CPU',
    isTauriSupported: true,
    hasAvx2: true,
  });
}
