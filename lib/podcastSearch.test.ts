import { describe, it, expect } from 'vitest';
import { resolvePodcastQuery, categoryNames, toTopPodcasts } from './podcastSearch';

describe('resolvePodcastQuery', () => {
  it('routes a search term to the byterm search', () => {
    expect(resolvePodcastQuery({ search: 'abc news' })).toEqual({ kind: 'search', term: 'abc news' });
  });

  it('trims surrounding whitespace from the search term', () => {
    expect(resolvePodcastQuery({ search: '  hku  ' })).toEqual({ kind: 'search', term: 'hku' });
  });

  it('falls back to the tag browse when no search term is present', () => {
    expect(resolvePodcastQuery({ tag: 'History' })).toEqual({ kind: 'tag', tag: 'History' });
  });

  it('prefers search over tag when both are present', () => {
    expect(resolvePodcastQuery({ search: 'hku', tag: 'History' })).toEqual({ kind: 'search', term: 'hku' });
  });

  it('treats a whitespace-only search as absent and uses the tag instead', () => {
    expect(resolvePodcastQuery({ search: '   ', tag: 'History' })).toEqual({ kind: 'tag', tag: 'History' });
  });

  it('falls back to trending when no params are supplied', () => {
    expect(resolvePodcastQuery({})).toEqual({ kind: 'trending' });
  });

  it('takes the first value when Next.js hands back an array', () => {
    expect(resolvePodcastQuery({ search: ['first', 'second'] })).toEqual({ kind: 'search', term: 'first' });
  });
});

describe('categoryNames', () => {
  it('flattens the categoryId -> name map returned by the Podcast Index', () => {
    expect(categoryNames({ 132: 'News', 134: 'Daily' })).toEqual(['News', 'Daily']);
  });

  it('returns an empty array for a null or missing map', () => {
    expect(categoryNames(null)).toEqual([]);
    expect(categoryNames(undefined)).toEqual([]);
  });

  it('drops empty category names', () => {
    expect(categoryNames({ 1: 'News', 2: '' })).toEqual(['News']);
  });
});

describe('toTopPodcasts', () => {
  it('prefers artwork over image for the cover', () => {
    const [podcast] = toTopPodcasts([
      { id: 1, title: 'Show', description: 'Desc', image: 'low.jpg', artwork: 'high.jpg', lastUpdateTime: 100 },
    ]);
    expect(podcast.image).toBe('high.jpg');
  });

  it('falls back to image when artwork is absent', () => {
    const [podcast] = toTopPodcasts([
      { id: 1, title: 'Show', image: 'low.jpg', lastUpdateTime: 100 },
    ]);
    expect(podcast.image).toBe('low.jpg');
  });

  it('normalises a missing description to an empty string', () => {
    const [podcast] = toTopPodcasts([{ id: 1, title: 'Show', lastUpdateTime: 100 }]);
    expect(podcast.description).toBe('');
  });

  it('falls back to ownerName when author is missing', () => {
    const [podcast] = toTopPodcasts([
      { id: 1, title: 'Show', lastUpdateTime: 100, ownerName: 'ABC News' },
    ]);
    expect(podcast.author).toBe('ABC News');
  });

  it('normalises a missing categories map to null', () => {
    const [podcast] = toTopPodcasts([{ id: 1, title: 'Show', lastUpdateTime: 100 }]);
    expect(podcast.categories).toBeNull();
  });

  it('discards entries without a numeric id', () => {
    const podcasts = toTopPodcasts([
      { title: 'No id', lastUpdateTime: 1 } as never,
      { id: 2, title: 'Good', lastUpdateTime: 1 },
    ]);
    expect(podcasts).toHaveLength(1);
    expect(podcasts[0].id).toBe(2);
  });

  it('returns an empty array for a missing feeds payload', () => {
    expect(toTopPodcasts(null)).toEqual([]);
    expect(toTopPodcasts(undefined)).toEqual([]);
  });

  it('defaults a missing lastUpdateTime to 0, as returned by /podcasts/trending', () => {
    const [podcast] = toTopPodcasts([{ id: 1, title: 'Trending Show' }]);
    expect(podcast.lastUpdateTime).toBe(0);
  });
});