/**
 * Deno KV HTTP Proxy client for Next.js
 * Works with kv-proxy.ts deployed to Deno Deploy
 * Requires DENO_KV_URL and DENO_KV_TOKEN environment variables
 */

// Key builders for consistent key structure
export const PlaybackKeys = {
  aggregate: (type: 'peertube' | 'podcast' | 'live', contentId: string) => 
    ['playback', type, contentId] as const,
  
  session: (type: 'peertube' | 'podcast' | 'live', contentId: string, sessionId: string) => 
    ['playback', type, contentId, sessionId] as const,
  
  sessionsPrefix: (type: 'peertube' | 'podcast' | 'live', contentId: string) => 
    ['playback', type, contentId] as const,
  
  globalStats: ['playback', 'stats'] as const,
} as const;

export interface PlaybackSession {
  sessionId: string;
  contentId: string;
  contentType: 'peertube' | 'podcast' | 'live';
  contentTitle?: string;
  startedAt: number;
  endedAt?: number;
  duration?: number;
  ipHash: string;
  browser: string;
  os: string;
  device: string;
  country?: string;
  referrer?: string;
  userAgent: string;
  heartbeatCount: number;
  lastHeartbeatAt?: number;
}

interface KvEntry<T = unknown> {
  key: readonly unknown[];
  value: T;
  versionstamp: string;
}

interface KvListResult<T = unknown> {
  entries: KvEntry<T>[];
  cursor?: string;
}

class DenoKvProxyClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.DENO_KV_URL || '';
    this.token = process.env.DENO_KV_TOKEN || '';
    
    if (!this.baseUrl || !this.token) {
      console.warn('[DenoKV Proxy] DENO_KV_URL or DENO_KV_TOKEN not set. Using in-memory fallback.');
    }
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.baseUrl || !this.token) {
      return this.memoryFallback<T>(method, path, body);
    }

    // Ensure baseUrl doesn't end with slash
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/${path}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deno KV Proxy error: ${response.status} ${error}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // In-memory fallback for local development
  private memoryStore = new Map<string, { value: unknown; versionstamp: string }>();
  private versionCounter = 0;

  private memoryFallback<T>(method: string, path: string, body?: unknown): T {
    const normalizeKey = (key: unknown[]) => key.join(':');
    
    switch (method) {
      case 'GET': {
        if (path.startsWith('get/')) {
          const keyJson = decodeURIComponent(path.slice(4));
          const key = JSON.parse(keyJson);
          const k = normalizeKey(key);
          const entry = this.memoryStore.get(k);
          return { value: entry?.value, versionstamp: entry?.versionstamp } as T;
        }
        return { value: null, versionstamp: null } as T;
      }
      case 'POST': {
        if (path === 'set') {
          const { key, value } = body as { key: unknown[]; value: unknown };
          const k = normalizeKey(key);
          this.memoryStore.set(k, { 
            value, 
            versionstamp: `${Date.now()}:${++this.versionCounter}` 
          });
          return undefined as T;
        }
        if (path === 'atomic') {
          const { checks, mutations } = body as { checks: unknown[]; mutations: unknown[] };
          for (const mutation of mutations || []) {
            const m = mutation as { key: unknown[]; value: unknown; type: string };
            const k = normalizeKey(m.key);
            if (m.type === 'sum') {
              const existing = this.memoryStore.get(k);
              const current = (existing?.value as number) || 0;
              this.memoryStore.set(k, { 
                value: current + Number(m.value), 
                versionstamp: `${Date.now()}:${++this.versionCounter}` 
              });
            } else if (m.type === 'set') {
              this.memoryStore.set(k, { 
                value: m.value, 
                versionstamp: `${Date.now()}:${++this.versionCounter}` 
              });
            }
          }
          return { ok: true } as T;
        }
        if (path === 'list') {
          const { prefix, limit = 1000 } = body as { prefix: unknown[]; limit?: number };
          const prefixStr = normalizeKey(prefix);
          const entries: KvEntry[] = [];
          for (const [k, v] of this.memoryStore) {
            if (k.startsWith(prefixStr)) {
              entries.push({ key: k.split(':') as any, value: v.value, versionstamp: v.versionstamp });
            }
          }
          return { entries } as T;
        }
        if (path === 'get-many') {
          const { keys } = body as { keys: unknown[][] };
          const results = keys.map((key: unknown[]) => {
            const k = normalizeKey(key);
            const entry = this.memoryStore.get(k);
            return { value: entry?.value, versionstamp: entry?.versionstamp };
          });
          return { results } as T;
        }
        return undefined as T;
      }
      default:
        return undefined as T;
    }
  }

  async get<T>(key: readonly unknown[]): Promise<{ value: T | null; versionstamp: string | null }> {
    const keyPath = JSON.stringify(key);
    const result = await this.request<{ value: T; versionstamp: string }>(
      'GET',
      `get/${encodeURIComponent(keyPath)}`
    );
    return { value: result?.value ?? null, versionstamp: result?.versionstamp ?? null };
  }

  async set(key: readonly unknown[], value: unknown): Promise<void> {
    await this.request('POST', 'set', { key, value });
  }

  atomic(): AtomicOperationBuilder {
    return new AtomicOperationBuilder(this);
  }

  async list<T>({ prefix, limit = 1000 }: { prefix: readonly unknown[]; limit?: number }): Promise<KvListResult<T>> {
    const result = await this.request<KvListResult<T>>('POST', 'list', { prefix, limit });
    return result;
  }

  async getMany<T>(keys: readonly unknown[][]): Promise<Array<{ value: T | null; versionstamp: string | null }>> {
    const result = await this.request<{ results: Array<{ value: T; versionstamp: string }> }>(
      'POST',
      'get-many',
      { keys }
    );
    return result.results.map(r => ({ value: r.value ?? null, versionstamp: r.versionstamp ?? null }));
  }
}

class AtomicOperationBuilder {
  private client: DenoKvProxyClient;
  private checks: Array<{ key: unknown[]; versionstamp: string | null }> = [];
  private mutations: Array<{ type: string; key: unknown[]; value: unknown }> = [];

  constructor(client: DenoKvProxyClient) {
    this.client = client;
  }

  check(check: { key: readonly unknown[]; versionstamp: string | null }) {
    this.checks.push({ key: [...check.key], versionstamp: check.versionstamp });
    return this;
  }

  set(key: readonly unknown[], value: unknown) {
    this.mutations.push({ type: 'set', key: [...key], value });
    return this;
  }

  sum(key: readonly unknown[], value: bigint | number) {
    this.mutations.push({ type: 'sum', key: [...key], value: Number(value) });
    return this;
  }

  delete(key: readonly unknown[]) {
    this.mutations.push({ type: 'delete', key: [...key], value: undefined });
    return this;
  }

  min(key: readonly unknown[], value: unknown) {
    this.mutations.push({ type: 'min', key: [...key], value });
    return this;
  }

  max(key: readonly unknown[], value: unknown) {
    this.mutations.push({ type: 'max', key: [...key], value });
    return this;
  }

  async commit(): Promise<{ ok: boolean }> {
    return this.client.request<{ ok: boolean }>('POST', 'atomic', {
      checks: this.checks,
      mutations: this.mutations,
    });
  }
}

// Singleton instance
let kvClient: DenoKvProxyClient | null = null;

export function getClient(): DenoKvProxyClient {
  if (!kvClient) {
    kvClient = new DenoKvProxyClient();
  }
  return kvClient;
}

/**
 * Increment aggregate play count atomically
 */
export async function incrementPlayCount(
  type: 'peertube' | 'podcast' | 'live',
  contentId: string
): Promise<number> {
  const client = getClient();
  const key = PlaybackKeys.aggregate(type, contentId);
  
  const getResult = await client.get<number>(key);
  const currentValue = getResult.value || 0;
  const newValue = currentValue + 1;
  
  await client.set(key, newValue);
  
  return newValue;
}

/**
 * Create a new playback session
 */
export async function createPlaybackSession(
  session: PlaybackSession
): Promise<void> {
  const client = getClient();
  const key = PlaybackKeys.session(session.contentType, session.contentId, session.sessionId);
  await client.set(key, session);
}

/**
 * Update playback session (heartbeat, end)
 */
export async function updatePlaybackSession(
  type: 'peertube' | 'podcast' | 'live',
  contentId: string,
  sessionId: string,
  updates: Partial<PlaybackSession>
): Promise<void> {
  const client = getClient();
  const key = PlaybackKeys.session(type, contentId, sessionId);
  
  const existing = await client.get<PlaybackSession>(key);
  if (!existing.value) return;
  
  const updated = { ...existing.value, ...updates };
  await client.set(key, updated);
}

/**
 * End playback session and update aggregate stats
 */
export async function endPlaybackSession(
  type: 'peertube' | 'podcast' | 'live',
  contentId: string,
  sessionId: string,
  endedAt: number,
  duration: number
): Promise<void> {
  const client = getClient();
  const sessionKey = PlaybackKeys.session(type, contentId, sessionId);
  
  const session = await client.get<PlaybackSession>(sessionKey);
  if (session.value) {
    await client.set(sessionKey, {
      ...session.value,
      endedAt,
      duration,
    });
  }
  
  await client.atomic()
    .sum(PlaybackKeys.globalStats, 1)
    .commit();
}

export async function getPlaybackSession(
  type: 'peertube' | 'podcast' | 'live',
  contentId: string,
  sessionId: string
): Promise<PlaybackSession | null> {
  const client = getClient();
  const key = PlaybackKeys.session(type, contentId, sessionId);
  const result = await client.get<PlaybackSession>(key);
  return result.value ?? null;
}

/**
 * Get aggregate play count for content
 */
export async function getPlayCount(
  type: 'peertube' | 'podcast' | 'live',
  contentId: string
): Promise<number> {
  const client = getClient();
  const key = PlaybackKeys.aggregate(type, contentId);
  const result = await client.get<number>(key);
  return result.value || 0;
}

/**
 * Get all sessions for content (for analytics dashboard)
 */
export async function getContentSessions(
  type: 'peertube' | 'podcast' | 'live',
  contentId: string,
  limit = 100
): Promise<PlaybackSession[]> {
  const client = getClient();
  const prefix = PlaybackKeys.sessionsPrefix(type, contentId);
  
  const result = await client.list<PlaybackSession>({ prefix, limit });
  
  return result.entries
    .map(e => e.value)
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Get global stats
 */
export async function getGlobalStats(): Promise<{
  totalPlays: number;
  peertubePlays: number;
  podcastPlays: number;
  livePlays: number;
}> {
  const client = getClient();
  
  const [global, peertube, podcast, live] = await Promise.all([
    client.get<{ totalPlays: number }>(PlaybackKeys.globalStats),
    client.list({ prefix: ['playback', 'peertube'] }),
    client.list({ prefix: ['playback', 'podcast'] }),
    client.list({ prefix: ['playback', 'live'] }),
  ]);
  
  let peertubePlays = 0;
  for (const entry of peertube.entries) {
    if (typeof entry.value === 'number') peertubePlays += entry.value;
  }
  
  let podcastPlays = 0;
  for (const entry of podcast.entries) {
    if (typeof entry.value === 'number') podcastPlays += entry.value;
  }
  
  let livePlays = 0;
  for (const entry of live.entries) {
    if (typeof entry.value === 'number') livePlays += entry.value;
  }
  
  return {
    totalPlays: global.value?.totalPlays || peertubePlays + podcastPlays + livePlays,
    peertubePlays,
    podcastPlays,
    livePlays,
  };
}