import { NextResponse } from 'next/server';
import { LocalSDImageProvider } from '@/lib/imageProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const localProvider = new LocalSDImageProvider();
  const status = await localProvider.getStatus();
  return NextResponse.json(status);
}
