import { describe, it, expect } from 'vitest';
import {
  isPrivateAddress,
  assertAllowedHostname,
  assertPublicHttpUrl,
  safeFetch,
} from './urlGuard';

describe('isPrivateAddress', () => {
  it('rejects cloud metadata endpoint', () => {
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('rejects IPv4 loopback', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('127.1.2.3')).toBe(true);
  });

  it('rejects decimal-encoded loopback', () => {
    expect(isPrivateAddress('2130706433')).toBe(true);
  });

  it('rejects RFC1918 private ranges', () => {
    expect(isPrivateAddress('10.0.0.5')).toBe(true);
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
  });

  it('allows public addresses adjacent to private ranges', () => {
    expect(isPrivateAddress('172.15.0.1')).toBe(false);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
    expect(isPrivateAddress('11.0.0.1')).toBe(false);
    expect(isPrivateAddress('193.168.1.1')).toBe(false);
  });

  it('rejects IPv6 loopback and unique-local', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('fd12:3456::1')).toBe(true);
  });

  it('rejects IPv6 link-local', () => {
    expect(isPrivateAddress('fe80::1')).toBe(true);
  });

  it('rejects IPv4-mapped IPv6 private addresses', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
  });

  it('rejects unspecified address', () => {
    expect(isPrivateAddress('0.0.0.0')).toBe(true);
    expect(isPrivateAddress('::')).toBe(true);
  });

  it('rejects carrier-grade NAT range', () => {
    expect(isPrivateAddress('100.64.0.1')).toBe(true);
  });
});

describe('assertAllowedHostname', () => {
  const allow = ['youtube.com', 'www.youtube.com', 'youtu.be'];

  it('accepts exact allowlist match', () => {
    expect(() => assertAllowedHostname('youtube.com', allow)).not.toThrow();
  });

  it('accepts subdomain of allowlisted domain', () => {
    expect(() => assertAllowedHostname('m.youtube.com', allow)).not.toThrow();
  });

  it('rejects unlisted domain', () => {
    expect(() => assertAllowedHostname('evil.com', allow)).toThrow(/not allowed/i);
  });

  it('rejects suffix-confusion domain', () => {
    // "evilyoutube.com" must NOT pass a naive endsWith check
    expect(() => assertAllowedHostname('evilyoutube.com', allow)).toThrow(/not allowed/i);
  });

  it('rejects subdomain of unlisted domain', () => {
    expect(() => assertAllowedHostname('a.b.evil.com', allow)).toThrow(/not allowed/i);
  });

  it('is case-insensitive', () => {
    expect(() => assertAllowedHostname('YouTube.COM', allow)).not.toThrow();
  });

  it('normalizes FQDN trailing dot on the allowlisted host', () => {
    expect(() => assertAllowedHostname('youtube.com.', allow)).not.toThrow();
  });

  it('does not let a trailing dot smuggle an unlisted host past the check', () => {
    expect(() => assertAllowedHostname('evil.com.', allow)).toThrow(/not allowed/i);
    expect(() => assertAllowedHostname('evilyoutube.com.', allow)).toThrow(/not allowed/i);
  });
});

describe('assertPublicHttpUrl', () => {
  it('accepts ordinary public http url', () => {
    expect(() => assertPublicHttpUrl('http://example.com/stream.m3u8')).not.toThrow();
  });

  it('accepts public https url', () => {
    expect(() => assertPublicHttpUrl('https://cdn.example.com/a.m3u')).not.toThrow();
  });

  it('rejects non-http protocols', () => {
    expect(() => assertPublicHttpUrl('file:///etc/passwd')).toThrow(/protocol/i);
    expect(() => assertPublicHttpUrl('gopher://example.com/')).toThrow(/protocol/i);
    expect(() => assertPublicHttpUrl('ftp://example.com/')).toThrow(/protocol/i);
  });

  it('rejects literal private IP hosts', () => {
    expect(() => assertPublicHttpUrl('http://169.254.169.254/latest/meta-data/')).toThrow();
    expect(() => assertPublicHttpUrl('http://127.0.0.1:3000/api/db')).toThrow();
    expect(() => assertPublicHttpUrl('http://10.0.0.5/admin')).toThrow();
    expect(() => assertPublicHttpUrl('http://192.168.1.1/')).toThrow();
    expect(() => assertPublicHttpUrl('http://172.16.0.1/')).toThrow();
    expect(() => assertPublicHttpUrl('http://[::1]:8080/')).toThrow();
  });

  it('rejects decimal-encoded loopback host', () => {
    expect(() => assertPublicHttpUrl('http://2130706433/')).toThrow();
  });

  it('rejects localhost by name', () => {
    expect(() => assertPublicHttpUrl('http://localhost:5432/')).toThrow();
  });

  it('rejects malformed url', () => {
    expect(() => assertPublicHttpUrl('not a url')).toThrow();
    expect(() => assertPublicHttpUrl('')).toThrow();
  });
});

describe('safeFetch', () => {
  it('passes through a normal public fetch', async () => {
    const fake = () => Promise.resolve(new Response('ok', { status: 200 }));
    const { response, finalUrl } = await safeFetch('https://example.com/x', { fetchImpl: fake });
    expect(await response.text()).toBe('ok');
    expect(finalUrl).toBe('https://example.com/x');
  });

  it('rejects before fetching when target is private', async () => {
    let called = false;
    const fake = () => {
      called = true;
      return Promise.resolve(new Response('should-not-happen'));
    };
    await expect(
      safeFetch('http://169.254.169.254/latest/meta-data/', { fetchImpl: fake }),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });

  it('blocks a redirect that points at an internal address', async () => {
    const fake = (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.startsWith('https://example.com')) {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' },
          }),
        );
      }
      return Promise.resolve(new Response('internal-secret'));
    };
    await expect(
      safeFetch('https://example.com/redirect', { fetchImpl: fake, maxRedirects: 3 }),
    ).rejects.toThrow();
  });

  it('follows a redirect that stays public', async () => {
    const fake = (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.startsWith('https://example.com/a')) {
        return Promise.resolve(
          new Response(null, { status: 301, headers: { location: 'https://cdn.example.com/b' } }),
        );
      }
      return Promise.resolve(new Response('final-content'));
    };
    const { response, finalUrl } = await safeFetch('https://example.com/a', { fetchImpl: fake, maxRedirects: 3 });
    expect(await response.text()).toBe('final-content');
    expect(finalUrl).toBe('https://cdn.example.com/b');
  });

  it('resolves a relative redirect location against the previous hop', async () => {
    const fake = (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url === 'https://example.com/live/stream.m3u8') {
        return Promise.resolve(
          new Response(null, { status: 302, headers: { location: '../keyed/real.m3u8' } }),
        );
      }
      return Promise.resolve(new Response('ok'));
    };
    const { finalUrl } = await safeFetch('https://example.com/live/stream.m3u8', { fetchImpl: fake });
    expect(finalUrl).toBe('https://example.com/keyed/real.m3u8');
  });

  it('refuses to follow more than maxRedirects', async () => {
    let n = 0;
    const fake = () => {
      n += 1;
      return Promise.resolve(
        new Response(null, { status: 302, headers: { location: `https://example.com/${n}` } }),
      );
    };
    await expect(
      safeFetch('https://example.com/loop', { fetchImpl: fake, maxRedirects: 2 }),
    ).rejects.toThrow(/redirect/i);
  });
});