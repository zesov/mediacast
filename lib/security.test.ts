import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminRequest, extractClientIp, createRateLimiter } from './security';

describe('isAdminRequest', () => {
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'super-secret-token';
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = originalToken;
  });

  const header = (value?: string) =>
    value === undefined ? new Headers() : new Headers({ authorization: `Bearer ${value}` });

  it('rejects when the request carries no credential', () => {
    expect(isAdminRequest(header())).toBe(false);
  });

  it('rejects a wrong token', () => {
    expect(isAdminRequest(header('nope'))).toBe(false);
  });

  it('accepts the correct token', () => {
    expect(isAdminRequest(header('super-secret-token'))).toBe(true);
  });

  it('rejects a token that is a prefix of the real one', () => {
    expect(isAdminRequest(header('super-secret'))).toBe(false);
  });

  it('rejects a token with the real one as a prefix', () => {
    expect(isAdminRequest(header('super-secret-token-plus-extra'))).toBe(false);
  });

  it('rejects every request when ADMIN_TOKEN is unset', () => {
    delete process.env.ADMIN_TOKEN;
    expect(isAdminRequest(header('anything'))).toBe(false);
  });

  it('rejects an empty ADMIN_TOKEN even when the header is empty', () => {
    process.env.ADMIN_TOKEN = '';
    expect(isAdminRequest(header(''))).toBe(false);
  });

  it('accepts a bare token without the Bearer prefix', () => {
    expect(isAdminRequest(new Headers({ authorization: 'super-secret-token' }))).toBe(true);
  });

  it('ignores case in the scheme', () => {
    expect(isAdminRequest(new Headers({ authorization: 'bearer super-secret-token' }))).toBe(true);
  });
});

describe('extractClientIp', () => {
  it('takes the first entry of a chained x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
    expect(extractClientIp(headers)).toBe('1.2.3.4');
  });

  it('trims surrounding whitespace', () => {
    expect(extractClientIp(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to cf-connecting-ip', () => {
    expect(extractClientIp(new Headers({ 'cf-connecting-ip': '8.8.8.8' }))).toBe('8.8.8.8');
  });

  it('falls back to x-real-ip', () => {
    expect(extractClientIp(new Headers({ 'x-real-ip': '4.4.4.4' }))).toBe('4.4.4.4');
  });

  it('returns unknown when no header is present', () => {
    expect(extractClientIp(new Headers())).toBe('unknown');
  });

  it('caps header length so a spoofed value cannot bloat the store', () => {
    const long = '1.1.1.1, ' + 'x'.repeat(500);
    expect(extractClientIp(new Headers({ 'x-forwarded-for': long })).length).toBeLessThanOrEqual(64);
  });
});

describe('createRateLimiter', () => {
  it('allows up to the limit then rejects', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });

  it('keeps separate buckets per key', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('b')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });

  it('resets once the window elapses', async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 20 });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(limiter.check('a')).toBe(true);
  });

  it('caps the store when flooded with unique keys', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    for (let i = 0; i < 12_000; i++) {
      limiter.check(`key-${i}`);
    }

    expect(limiter.size()).toBeLessThanOrEqual(10_000);
  });

  it('drops expired entries instead of retaining them forever', async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 20 });
    limiter.check('a');
    await new Promise((resolve) => setTimeout(resolve, 40));
    limiter.check('b');

    expect(limiter.size()).toBe(1);
  });
});