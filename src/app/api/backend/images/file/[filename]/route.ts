import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { resolveSafeBackendImagePath } from '@/lib/backendDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const fullPath = resolveSafeBackendImagePath(filename || '');
  if (!fullPath || !fs.existsSync(fullPath)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const lower = filename.toLowerCase();
  const contentType = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
    ? 'image/webp'
    : lower.endsWith('.webm')
    ? 'video/webm'
    : lower.endsWith('.mp4')
    ? 'video/mp4'
    : 'image/jpeg';

  const buffer = fs.readFileSync(fullPath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
