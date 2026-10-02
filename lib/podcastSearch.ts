import type { TopPodcast } from '@/app/types';

export type PodcastQuery =
  | { kind: 'search'; term: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'trending' };

interface RawQueryParams {
  search?: string | string[];
  tag?: string | string[];
}

export interface RawFeed {
  id: number;
  title: string;
  description?: string;
  image?: string;
  artwork?: string;
  lastUpdateTime?: number;
  author?: string;
  ownerName?: string;
  categories?: Record<string, string> | null;
  language?: string;
}

function firstValue(value?: string | string[]): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? '').trim();
}

export function resolvePodcastQuery(params: RawQueryParams): PodcastQuery {
  const term = firstValue(params.search);
  if (term) return { kind: 'search', term };

  const tag = firstValue(params.tag);
  if (tag) return { kind: 'tag', tag };

  return { kind: 'trending' };
}

export function categoryNames(categories?: Record<string, string> | null): string[] {
  if (!categories) return [];
  return Object.values(categories).filter((name): name is string => Boolean(name));
}

export function toTopPodcasts(feeds?: RawFeed[] | null): TopPodcast[] {
  if (!Array.isArray(feeds)) return [];

  return feeds
    .filter((feed): feed is RawFeed => Boolean(feed) && typeof feed.id === 'number')
    .map((feed) => ({
      id: feed.id,
      title: feed.title ?? '',
      description: feed.description ?? '',
      image: feed.artwork || feed.image || '',
      lastUpdateTime: feed.lastUpdateTime ?? 0,
      author: feed.author || feed.ownerName || '',
      ownerName: feed.ownerName,
      categories: feed.categories ?? null,
      artwork: feed.artwork,
      language: feed.language,
    }));
}