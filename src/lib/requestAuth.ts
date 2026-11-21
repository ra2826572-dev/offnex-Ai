import { NextRequest } from 'next/server';

export function isTrustedSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (!host) return true;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}

export function getRequestUserMeta(req: NextRequest): {
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: string;
} {
  const headerId = req.headers.get('x-user-id')?.trim();
  const headerEmail = req.headers.get('x-user-email')?.trim();
  const cookieRaw = req.cookies.get('offnex_active_user')?.value;

  if (cookieRaw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(cookieRaw)) as {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
      };
      const fullName = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ').trim();
      return {
        userId: headerId || parsed.id,
        userEmail: headerEmail || parsed.email,
        userName: fullName || parsed.email,
        role: parsed.role,
      };
    } catch {
      // Ignore malformed cookie
    }
  }

  return {
    userId: headerId || undefined,
    userEmail: headerEmail || undefined,
  };
}
