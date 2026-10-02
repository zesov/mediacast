/**
 * Privacy utilities for playback tracking
 * Ensures no PII is stored - only hashed identifiers
 */

/**
 * Hash IP address with a secret salt for privacy
 * Uses Web Crypto API (Edge runtime compatible)
 */
export async function hashIp(ip: string, salt?: string): Promise<string> {
  const secret = salt || process.env.IP_HASH_SALT;
  if (!secret) {
    throw new Error(
      'IP_HASH_SALT is not set. A published default salt would let anyone reverse these hashes.'
    );
  }

  const data = `${ip}:${secret}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Extract client IP from request headers (Vercel/Cloudflare/standard)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

/**
 * Extract non-sensitive browser info from User-Agent
 */
export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const result = { browser: 'unknown', os: 'unknown', device: 'desktop' };
  
  if (!ua) return result;
  
  // Browser
  if (ua.includes('Edg/')) result.browser = 'edge';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) result.browser = 'chrome';
  else if (ua.includes('Firefox/')) result.browser = 'firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) result.browser = 'safari';
  else if (ua.includes('Opera/') || ua.includes('OPR/')) result.browser = 'opera';
  
  // OS
  if (ua.includes('Windows NT')) result.os = 'windows';
  else if (ua.includes('Mac OS X')) result.os = 'macos';
  else if (ua.includes('Linux')) result.os = 'linux';
  else if (ua.includes('Android')) result.os = 'android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) result.os = 'ios';
  
  // Device
  if (ua.includes('Mobile') || ua.includes('Android') && ua.includes('Mobile')) result.device = 'mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) result.device = 'tablet';
  
  return result;
}

/**
 * Get country from Cloudflare headers
 */
export function getCountry(request: Request): string | undefined {
  return request.headers.get('cf-ipcountry') || undefined;
}

/**
 * Generate anonymous session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}