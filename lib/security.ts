import { timingSafeEqual } from 'node:crypto';

/**
 * Guards for endpoints that expose internal state, plus the shared rate limiter.
 */

const MAX_IP_LENGTH = 64;

export function isAdminRequest(headers: Headers): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const header = headers.get('authorization');
  if (!header) return false;

  const provided = header.replace(/^bearer\s+/i, '');
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Client IP for rate-limiting purposes. Only the first x-forwarded-for entry is
 * used: a client that appends its own entries must not mint a fresh bucket per
 * request. Value is length-capped so a spoofed header cannot bloat the store.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim().slice(0, MAX_IP_LENGTH) || 'unknown';
  }
  return (
    headers.get('cf-connecting-ip')?.trim().slice(0, MAX_IP_LENGTH) ||
    headers.get('x-real-ip')?.trim().slice(0, MAX_IP_LENGTH) ||
    'unknown'
  );
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  check: (key: string) => boolean;
  size: () => number;
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions): RateLimiter {
  const maxEntries = 10_000;
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = 0;

  const evictExpired = (now: number) => {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  };

  return {
    check(key: string): boolean {
      const now = Date.now();
      evictExpired(now);

      const entry = hits.get(key);
      if (entry && now <= entry.resetAt) {
        if (entry.count >= limit) return false;
        entry.count += 1;
        return true;
      }

      if (hits.size >= maxEntries) {
        const oldest = hits.keys().next();
        if (!oldest.done) hits.delete(oldest.value);
      }
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    },
    size(): number {
      return hits.size;
    },
  };
}