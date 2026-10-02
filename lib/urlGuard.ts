/**
 * SSRF guard for server-side fetches of user-supplied URLs.
 *
 * Threat model: `/api/parseM3u`, `/api/free-tv/proxy` and `/api/youtube/live`
 * all accept a URL from the request and fetch it from the server. Without a
 * guard an attacker can reach the cloud metadata endpoint (169.254.169.254),
 * loopback, and RFC1918 internal services.
 *
 * Note: these checks are string-level, applied to the URL *as written*. They
 * do not resolve DNS, so a hostname whose DNS record points at a private
 * address still passes. That is acceptable for the stream-proxy endpoints
 * (arbitrary public IPTV hosts are the feature) but such a fetch should run
 * with egress restrictions at the network layer.
 */

/** Parse an IPv4 address from dotted-quad or single-integer (decimal) form. */
function parseIPv4(host: string): number[] | null {
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isSafeInteger(n) || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.some((p) => p > 255) ? null : parts;
}

function isPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  return false;
}

/** Expand an IPv6 literal into eight 16-bit groups. */
function parseIPv6(host: string): number[] | null {
  let h = host.replace(/^\[|\]$/g, '');

  // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1
  let embedded: number[] | null = null;
  const lastColon = h.lastIndexOf(':');
  const tail = h.slice(lastColon + 1);
  if (tail.includes('.')) {
    embedded = parseIPv4(tail);
    if (!embedded) return null;
    h = h.slice(0, lastColon + 1) + '0:0';
  }

  const [left, right = ''] = h.includes('::') ? h.split('::') : [h, null];
  const l = left ? left.split(':').filter(Boolean) : [];
  const r = right ? right.split(':').filter(Boolean) : [];
  const fill = 8 - l.length - r.length;
  if (fill < 0 || (!h.includes('::') && fill !== 0)) return null;

  const hex = [...l, ...Array(h.includes('::') ? fill : 0).fill('0'), ...r];
  if (hex.length !== 8 || hex.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  const groups = hex.map((g) => parseInt(g, 16));

  // Rewrite the two trailing groups for an embedded IPv4 address.
  if (embedded) {
    groups[6] = (embedded[0] << 8) | embedded[1];
    groups[7] = (embedded[2] << 8) | embedded[3];
  }
  return groups;
}

function isPrivateIPv6(g: number[]): boolean {
  const isZero = g.every((x) => x === 0);
  if (isZero) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1

  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  const leadingZero = g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0);
  if (leadingZero) return isPrivateIPv4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);

  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/** True when the literal is an internal/reserved address we must not fetch. */
export function isPrivateAddress(host: string): boolean {
  const v4 = parseIPv4(host);
  if (v4) return isPrivateIPv4(v4);
  const v6 = parseIPv6(host);
  if (v6) return isPrivateIPv6(v6);
  return false;
}

/**
 * Hostname allowlist check. Matches the exact host or a true subdomain of it,
 * so `evilyoutube.com` cannot pass a rule intended for `youtube.com`.
 */
export function assertAllowedHostname(hostname: string, allowed: string[]): void {
  // A trailing dot is a FQDN spelling trick, not a legitimate alternate form.
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const ok = allowed.some((rule) => {
    const r = rule.toLowerCase();
    return host === r || host.endsWith(`.${r}`);
  });
  if (!ok) throw new Error(`Host "${hostname}" is not allowed`);
}

/** Validate a user-supplied target before any server-side request. */
export function assertPublicHttpUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: "${url.protocol}"`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const lowered = host.toLowerCase();
  if (lowered === 'localhost' || lowered.endsWith('.localhost')) {
    throw new Error(`Refusing to fetch internal host: "${host}"`);
  }
  if (isPrivateAddress(host)) {
    throw new Error(`Refusing to fetch internal address: "${host}"`);
  }
}

export interface SafeFetchOptions {
  /** Injected for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  maxRedirects?: number;
  init?: RequestInit;
}

/**
 * fetch() that validates the initial URL and every redirect hop.
 *
 * `redirect: 'manual'` is the important part: with the default `follow` the
 * runtime would happily chase a 302 from a public host to 169.254.169.254
 * without ever re-entering this guard.
 */
export interface SafeFetchResult {
  response: Response;
  finalUrl: string;
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { fetchImpl = fetch, maxRedirects = 5, init } = options;
  let current = url;

  for (let hop = 0; ; hop++) {
    assertPublicHttpUrl(current);
    const response = await fetchImpl(current, { ...init, redirect: 'manual' });

    const location = response.headers?.get?.('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return { response, finalUrl: current };
    }

    if (hop >= maxRedirects) throw new Error(`Too many redirects (>${maxRedirects})`);
    current = new URL(location, current).toString();
  }
}