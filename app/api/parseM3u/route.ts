import { NextRequest, NextResponse } from 'next/server';
import { parseM3U } from '@/lib/m3uParser';
import { assertPublicHttpUrl, safeFetch } from '@/lib/urlGuard';

// Simple in-memory rate limiter (per IP, 10 req/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
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
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
