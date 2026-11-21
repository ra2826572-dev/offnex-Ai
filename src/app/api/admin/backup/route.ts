import { NextResponse } from 'next/server';
import { exportBackendFullSnapshot } from '@/lib/backendDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = exportBackendFullSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'Content-Disposition': `attachment; filename="offnex_backend_backup_${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
