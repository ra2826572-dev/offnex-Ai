import { NextRequest } from 'next/server';

export const PINTEREST_COOKIE_NAME = 'offnex_pinterest_token';

export interface PinterestPinItem {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl: string;
  pinUrl: string;
  author?: string;
  boardName?: string;
  width?: number;
  height?: number;
  source:
    | 'pinterest_oauth'
    | 'pinterest_oembed'
    | 'pinterest_rss'
    | 'pinterest_search'
    | 'pinterest_ideas';
}

export interface PinterestBoardItem {
  id: string;
  name: string;
  description?: string;
  pinCount?: number;
  imageThumbnailUrl?: string;
}

export interface PinterestUserSummary {
  username: string;
  businessName?: string;
  profileImage?: string;
  accountType?: string;
}

const PIN_HOST_ALLOWLIST = ['.pinimg.com', '.pinterest.com', 'pinimg.com', 'pinterest.com'];

export function isAllowedPinterestImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return PIN_HOST_ALLOWLIST.some((suffix) =>
      suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

export function upgradePinimgResolution(url: string, target: '736x' | 'originals' = '736x'): string {
  if (!url.includes('i.pinimg.com/')) return url;
  return url.replace(
    /https:\/\/i\.pinimg\.com\/(?:236x|474x|564x)\//,
    `https://i.pinimg.com/${target}/`
  );
}

export function getPinterestAppBaseUrl(): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl && envAppUrl !== 'MY_APP_URL') {
    return envAppUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function getPinterestOAuthConfig() {
  const clientId = process.env.PINTEREST_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET?.trim() || '';
  const configured = Boolean(
    clientId &&
      clientSecret &&
      !clientId.startsWith('YOUR_') &&
      !clientSecret.startsWith('YOUR_')
  );
  const baseUrl = getPinterestAppBaseUrl();
  const callbackUrl = `${baseUrl}/api/pinterest/auth/callback`;

  return {
    clientId,
    clientSecret,
    configured,
    callbackUrl,
    baseUrl,
  };
}

export function buildPinterestOAuthUrl(state: string): string {
  const { clientId, callbackUrl } = getPinterestOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'boards:read,pins:read,user_accounts:read',
    state,
  });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

export function getPinterestTokenFromRequest(req?: NextRequest): string | null {
  const cookieToken = req?.cookies.get(PINTEREST_COOKIE_NAME)?.value?.trim();
  if (cookieToken) return cookieToken;
  const envToken = process.env.PINTEREST_ACCESS_TOKEN?.trim();
  if (envToken && !envToken.startsWith('YOUR_')) return envToken;
  return null;
}

export async function exchangePinterestCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const { clientId, clientSecret, callbackUrl } = getPinterestOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error('Pinterest OAuth client credentials are not configured.');
  }
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
  });

  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Pinterest token exchange failed (HTTP ${res.status}): ${raw.slice(0, 220)}`);
  }
  return JSON.parse(raw) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function fetchPinterestUserAccount(
  accessToken: string
): Promise<PinterestUserSummary | null> {
  try {
    const res = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      username?: string;
      business_name?: string;
      profile_image?: string;
      account_type?: string;
    };
    if (!data.username) return null;
    return {
      username: data.username,
      businessName: data.business_name,
      profileImage: data.profile_image,
      accountType: data.account_type,
    };
  } catch {
    return null;
  }
}

export async function fetchPinterestUserBoards(
  accessToken: string,
  pageSize = 20
): Promise<PinterestBoardItem[]> {
  try {
    const res = await fetch(`https://api.pinterest.com/v5/boards?page_size=${pageSize}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        name: string;
        description?: string;
        pin_count?: number;
        media?: { image_cover_url?: string };
      }>;
    };
    return (data.items || []).map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      pinCount: b.pin_count,
      imageThumbnailUrl: b.media?.image_cover_url,
    }));
  } catch {
    return [];
  }
}

export async function fetchPinterestUserPins(
  accessToken: string,
  boardId?: string,
  pageSize = 24
): Promise<PinterestPinItem[]> {
  try {
    const endpoint = boardId
      ? `https://api.pinterest.com/v5/boards/${encodeURIComponent(boardId)}/pins?page_size=${pageSize}`
      : `https://api.pinterest.com/v5/pins?page_size=${pageSize}`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        title?: string;
        description?: string;
        alt_text?: string;
        link?: string;
        board_id?: string;
        media?: {
          images?: Record<string, { url?: string; width?: number; height?: number }>;
        };
      }>;
    };
    const pins: PinterestPinItem[] = [];
    for (const p of data.items || []) {
      const imgs = p.media?.images || {};
      const best =
        imgs['1200x'] ||
        imgs['originals'] ||
        imgs['600x'] ||
        imgs['400x300'] ||
        imgs['150x150'] ||
        Object.values(imgs)[0];
      if (!best?.url) continue;
      pins.push({
        id: `pin-oauth-${p.id}`,
        title: (p.title || p.alt_text || p.description || 'Pinterest Pin').slice(0, 110),
        description: p.description,
        imageUrl: best.url,
        thumbnailUrl: imgs['400x300']?.url || best.url,
        pinUrl: `https://www.pinterest.com/pin/${p.id}/`,
        width: best.width,
        height: best.height,
        source: 'pinterest_oauth',
      });
    }
    return pins;
  } catch {
    return [];
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function translateSimpleRomanUrduForSearch(query: string): string {
  const q = query.trim();
  const hasUrduOrRoman =
    /[\u0600-\u06FF]|\b(ek|ka|ki|ke|mein|par|per|aur|khubsurat|tasveer|banao|wala|wali|shair|sher|samundar|pahar|raat|subah|larka|larki|ghar|kapde|dulhan|mehndi|khabar|gadi)\b/i.test(
      q
    );
  if (!hasUrduOrRoman) return q;

  const dictionary: Array<[RegExp, string]> = [
    [/\bkhubsurat\b/gi, 'beautiful'],
    [/\bghar\b/gi, 'modern house interior'],
    [/\bshair|sher\b/gi, 'lion wildlife'],
    [/\bsamundar\b/gi, 'ocean waves'],
    [/\bpahar\b/gi, 'mountains landscape'],
    [/\braat\b/gi, 'night aesthetic'],
    [/\bsubah\b/gi, 'sunrise morning'],
    [/\bgadi\b/gi, 'luxury car'],
    [/\bkapde|dress\b/gi, 'fashion outfit'],
    [/\bdulhan\b/gi, 'bridal fashion'],
    [/\bmehndi\b/gi, 'mehndi henna design'],
    [/\b(ek|ka|ki|ke|mein|par|per|aur|tasveer|banao|wala|wali)\b/gi, ' '],
  ];
  let out = q;
  for (const [rx, rep] of dictionary) {
    out = out.replace(rx, rep);
  }
  return out.replace(/\s+/g, ' ').trim() || q;
}

export async function extractPinFromUrl(
  rawPinUrl: string,
  signal?: AbortSignal
): Promise<PinterestPinItem | null> {
  try {
    const cleanUrl = rawPinUrl.trim();
    const res = await fetch(
      `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(cleanUrl)}`,
      {
        headers: { 'User-Agent': 'OffnexAI/1.0' },
        signal,
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
      width?: number;
      height?: number;
    };
    if (!data.thumbnail_url) return null;
    const highRes = upgradePinimgResolution(data.thumbnail_url, '736x');
    return {
      id: `pin-oembed-${Date.now()}`,
      title: data.title || 'Pinterest Pin',
      imageUrl: highRes,
      thumbnailUrl: data.thumbnail_url,
      pinUrl: cleanUrl,
      author: data.author_name,
      width: data.width,
      height: data.height,
      source: 'pinterest_oembed',
    };
  } catch {
    return null;
  }
}

export async function fetchPinterestBoardRss(
  boardUrlOrPath: string,
  limit = 20,
  signal?: AbortSignal
): Promise<PinterestPinItem[]> {
  try {
    let rssUrl = boardUrlOrPath.trim().replace(/\/+$/, '');
    if (!rssUrl.startsWith('http')) {
      rssUrl = `https://www.pinterest.com/${rssUrl.replace(/^\/+/, '')}`;
    }
    if (!rssUrl.endsWith('.rss')) {
      rssUrl = `${rssUrl}.rss`;
    }
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OffnexAI/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      signal,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const channelTitle =
      decodeHtmlEntities(xml.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/)?.[1] || 'Pinterest Board');

    const pins: PinterestPinItem[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const m of itemMatches) {
      if (pins.length >= limit) break;
      const itemXml = m[1];
      const title = decodeHtmlEntities(
        itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') ||
          channelTitle
      ).trim();
      const link = decodeHtmlEntities(itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
      const desc = decodeHtmlEntities(itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '');
      const imgMatch = desc.match(/https:\/\/i\.pinimg\.com\/[^"'\s<>]+/);
      if (!imgMatch) continue;
      const thumbUrl = imgMatch[0];
      const highRes = upgradePinimgResolution(thumbUrl, '736x');
      pins.push({
        id: `pin-rss-${pins.length}-${Date.now()}`,
        title: title || 'Pinterest Pin',
        imageUrl: highRes,
        thumbnailUrl: thumbUrl,
        pinUrl: link || 'https://www.pinterest.com/',
        boardName: channelTitle,
        source: 'pinterest_rss',
      });
    }
    return pins;
  } catch {
    return [];
  }
}

export async function fetchPinterestIdeasPins(
  categorySlug = '',
  limit = 18,
  signal?: AbortSignal
): Promise<PinterestPinItem[]> {
  try {
    const targetUrl = categorySlug
      ? `https://www.pinterest.com/ideas/${categorySlug.replace(/^\/+|\/+$/g, '')}/`
      : 'https://www.pinterest.com/ideas/';

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const rawUrls = [
      ...new Set(
        html.match(/https:\/\/i\.pinimg\.com\/(?:236x|474x|736x|originals)\/[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp)/g) ||
          []
      ),
    ];

    // Skip static UI sprite icons (d5/3b/01 etc.)
    const filtered = rawUrls.filter((u) => !u.includes('/d5/3b/01/') && !u.includes('75x75'));
    const seenHash = new Set<string>();
    const pins: PinterestPinItem[] = [];

    for (const raw of filtered) {
      if (pins.length >= limit) break;
      const filePart = raw.split('/').pop() || raw;
      if (seenHash.has(filePart)) continue;
      seenHash.add(filePart);
      pins.push({
        id: `pin-idea-${pins.length}-${filePart.slice(0, 8)}`,
        title: categorySlug ? `Pinterest ${categorySlug.split('/')[0].replace(/-/g, ' ')}` : 'Pinterest Trending Idea',
        imageUrl: upgradePinimgResolution(raw, '736x'),
        thumbnailUrl: raw,
        pinUrl: 'https://www.pinterest.com/ideas/',
        source: 'pinterest_ideas',
      });
    }
    return pins;
  } catch {
    return [];
  }
}

export async function searchPublicPinterestPins(
  rawQuery: string,
  limit = 18,
  signal?: AbortSignal
): Promise<PinterestPinItem[]> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return fetchPinterestIdeasPins('', limit, signal);
  }

  // 1. Direct Pinterest Pin URL
  if (/^https?:\/\/(www\.)?(pinterest\.com|pin\.it)\/pin\//i.test(trimmed) || /^https?:\/\/pin\.it\//i.test(trimmed)) {
    const single = await extractPinFromUrl(trimmed, signal);
    if (single) return [single];
  }

  // 2. Direct Pinterest Board URL
  if (/^https?:\/\/(www\.)?pinterest\.com\/[^/\s]+\/[^/\s]+\/?$/i.test(trimmed)) {
    const boardPins = await fetchPinterestBoardRss(trimmed, limit, signal);
    if (boardPins.length > 0) return boardPins;
  }

  // 3. Search public Pinterest pins indexed with high-res i.pinimg.com images
  const normalizedQuery = translateSimpleRomanUrduForSearch(trimmed);
  const pins: PinterestPinItem[] = [];
  const seenUrls = new Set<string>();

  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(
      `pinterest ${normalizedQuery}`
    )}&form=HDRSC2`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal,
    });

    if (res.ok) {
      const html = await res.text();
      const matches = html.matchAll(/class="iusc"[^>]*m="([^"]+)"/g);

      for (const m of matches) {
        if (pins.length >= limit) break;
        try {
          const decoded = decodeHtmlEntities(m[1]);
          const obj = JSON.parse(decoded) as {
            purl?: string;
            murl?: string;
            turl?: string;
            t?: string;
            desc?: string;
          };
          const murl = obj.murl || '';
          const purl = obj.purl || '';
          const isPinterest =
            murl.includes('pinimg.com') || /pinterest\.[a-z.]+\/pin\//i.test(purl);
          if (!isPinterest || !murl.startsWith('http')) continue;
          if (seenUrls.has(murl)) continue;
          seenUrls.add(murl);

          const cleanTitle = (obj.t || obj.desc || normalizedQuery)
            .replace(/[\uE000-\uF8FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100);

          pins.push({
            id: `pin-srch-${pins.length}-${Date.now()}`,
            title: cleanTitle || `${normalizedQuery} Pin`,
            imageUrl: upgradePinimgResolution(murl, '736x'),
            thumbnailUrl: obj.turl || murl,
            pinUrl: purl.includes('pinterest.') ? purl : 'https://www.pinterest.com/',
            source: 'pinterest_search',
          });
        } catch {
          // Skip malformed entry
        }
      }
    }
  } catch {
    // Fall back to Pinterest Ideas or Board RSS below
  }

  if (pins.length > 0) {
    return pins.slice(0, limit);
  }

  // Fallback to curated Pinterest public board RSS matching query category
  const qLow = normalizedQuery.toLowerCase();
  const boardSlug = qLow.includes('art') || qLow.includes('draw') || qLow.includes('paint')
    ? 'pinterest/art'
    : qLow.includes('fashion') || qLow.includes('dress') || qLow.includes('outfit')
    ? 'pinterest/womens-fashion'
    : qLow.includes('food') || qLow.includes('recipe') || qLow.includes('cake')
    ? 'pinterest/food-and-drink'
    : 'pinterest/home-decor';

  const rssFallback = await fetchPinterestBoardRss(boardSlug, limit, signal);
  if (rssFallback.length > 0) return rssFallback;

  return fetchPinterestIdeasPins('', limit, signal);
}

export async function fetchPinterestImageAsDataUrl(
  imageUrl: string,
  signal?: AbortSignal
): Promise<{ dataUrl: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' } | null> {
  const candidates = [imageUrl];
  if (imageUrl.includes('/736x/')) {
    candidates.push(imageUrl.replace('/736x/', '/474x/'));
    candidates.push(imageUrl.replace('/736x/', '/236x/'));
  }

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Referer: 'https://www.pinterest.com/',
        },
        signal,
      });
      if (!res.ok) continue;
      const rawCt = (res.headers.get('content-type') || 'image/jpeg').toLowerCase().split(';')[0];
      if (!rawCt.startsWith('image/')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 512) continue;

      const mimeType: 'image/png' | 'image/jpeg' | 'image/webp' =
        rawCt === 'image/png'
          ? 'image/png'
          : rawCt === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';

      return {
        dataUrl: `data:${mimeType};base64,${buf.toString('base64')}`,
        mimeType,
      };
    } catch {
      // Try next candidate
    }
  }
  return null;
}
