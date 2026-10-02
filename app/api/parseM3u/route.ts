import { NextRequest, NextResponse } from 'next/server';
import { parseM3U } from '@/lib/m3uParser';
import { assertPublicHttpUrl, safeFetch } from '@/lib/urlGuard';
import { createRateLimiter, extractClientIp } from '@/lib/security';

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  try {
    if (!limiter.check(extractClientIp(request.headers))) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      assertPublicHttpUrl(url);
    } catch {
      return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
    }

    const { response: res, finalUrl } = await safeFetch(url, {
      init: {
        headers: { 'User-Agent': 'M3U-Proxy/1.0' },
        signal: AbortSignal.timeout(15_000),
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch: HTTP ${res.status}` }, { status: 502 });
    }

    const text = await res.text();
    const result = parseM3U(text, finalUrl);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 502 });
  }
}
