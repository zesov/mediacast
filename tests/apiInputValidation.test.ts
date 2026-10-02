import { describe, it, expect, vi, beforeEach } from 'vitest';

const podcastById = vi.fn();
const episodesByFeedId = vi.fn();

vi.mock('@/app/api/db', () => ({
  client: { podcastById, episodesByFeedId },
}));

const { GET: podcastByIdGET } = await import('@/app/api/podcastById/route');
const { GET: episodesByFeedIdGET } = await import('@/app/api/episodesByFeedId/route');

function req(url: string) {
  return new Request(url) as never;
}

describe('podcast API input validation', () => {
  beforeEach(() => {
    podcastById.mockReset();
    episodesByFeedId.mockReset();
    podcastById.mockResolvedValue({ feed: { id: 42 } });
    episodesByFeedId.mockResolvedValue({ items: [] });
  });

  it('rejects a missing id with 400 instead of calling the upstream API with NaN', async () => {
    const res = await podcastByIdGET(req('http://localhost/api/podcastById'));
    expect(res.status).toBe(400);
    expect(podcastById).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-1', '1.5', '1e3', ' 1'])('rejects invalid id %j with 400', async (id) => {
    const res = await podcastByIdGET(req(`http://localhost/api/podcastById?id=${encodeURIComponent(id)}`));
    expect(res.status).toBe(400);
    expect(podcastById).not.toHaveBeenCalled();
  });

  it('accepts a valid positive integer id', async () => {
    const res = await podcastByIdGET(req('http://localhost/api/podcastById?id=42'));
    expect(res.status).toBe(200);
    expect(podcastById).toHaveBeenCalledWith(42);
  });

  it('applies revalidate caching to successful responses', async () => {
    const res = await podcastByIdGET(req('http://localhost/api/podcastById?id=42'));
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=600, stale-while-revalidate=1800');
  });

  it('rejects an invalid feed id on the episodes endpoint with 400', async () => {
    const res = await episodesByFeedIdGET(req('http://localhost/api/episodesByFeedId?id=abc'));
    expect(res.status).toBe(400);
    expect(episodesByFeedId).not.toHaveBeenCalled();
  });

  it('clamps max to at most 100 and defaults to 10', async () => {
    await episodesByFeedIdGET(req('http://localhost/api/episodesByFeedId?id=42&max=9999'));
    expect(episodesByFeedId).toHaveBeenLastCalledWith(42, { max: 100 });

    await episodesByFeedIdGET(req('http://localhost/api/episodesByFeedId?id=42&max=-5'));
    expect(episodesByFeedId).toHaveBeenLastCalledWith(42, { max: 10 });
  });

  it('never caches an error response', async () => {
    podcastById.mockRejectedValue(new Error('upstream down'));
    const res = await podcastByIdGET(req('http://localhost/api/podcastById?id=42'));
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control') ?? '').not.toContain('s-maxage');
  });
});
