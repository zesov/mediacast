'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Star } from 'lucide-react';
import { categoryNames } from '@/lib/podcastSearch';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { usePlayFirstEpisode } from '@/hooks/usePlayFirstEpisode';
import { addFavorite, removeFavorite, getFavorites } from '@/lib/favoritesStore';
import type { TopPodcast } from '@/app/types';

interface Props {
  feeds: TopPodcast[];
  heading: string;
}

function createFavorite(podcast: TopPodcast) {
  return {
    type: 'podcast' as const,
    id: podcast.id,
    title: podcast.title,
    description: podcast.description,
    image: podcast.image,
    lastUpdateTime: podcast.lastUpdateTime,
    addedAt: Date.now(),
  };
}

export default function SearchResults({ feeds, heading }: Props) {
  const t = useTranslations('search');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const { playFirstEpisode, pendingId, error } = usePlayFirstEpisode();
  const { visibleCount, hasMore, revealMore, sentinelRef } = useInfiniteReveal(feeds.length);

  useEffect(() => {
    getFavorites().then((list) => {
      setFavorites(new Set(list.filter((i) => i.type === 'podcast').map((i) => i.id as number)));
    });
  }, []);

  const handleToggleFavorite = async (podcast: TopPodcast) => {
    if (favorites.has(podcast.id)) {
      await removeFavorite('podcast', podcast.id);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(podcast.id);
        return next;
      });
    } else {
      await addFavorite(createFavorite(podcast));
      setFavorites((prev) => {
        const next = new Set(prev);
        next.add(podcast.id);
        return next;
      });
    }
  };

  if (feeds.length === 0) {
    return (
      <section className="mb-8 mt-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{heading}</h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t('noResultsHint')}</p>
      </section>
    );
  }

  return (
    <section className="mb-8 mt-8">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-200 pb-3 dark:border-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{heading}</h1>
        <span className="text-xs tabular-nums tracking-wide text-gray-500 dark:text-gray-400">
          {t('count', { shown: visibleCount, total: feeds.length })}
        </span>
      </header>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul>
        {feeds.slice(0, visibleCount).map((podcast) => {
          const categories = categoryNames(podcast.categories);
          const isFavorite = favorites.has(podcast.id);
          const isPending = pendingId === String(podcast.id);

          return (
            <li
              key={podcast.id}
              className="border-b border-gray-200 py-4 last:border-b-0 dark:border-gray-800"
            >
              <div className="flex items-center gap-4">
                <Link
                  href={`/podcast/${podcast.id}`}
                  className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  {podcast.image ? (
                    <img
                      src={podcast.image}
                      alt={podcast.title}
                      loading="lazy"
                      className="h-20 w-20 rounded-lg object-cover sm:h-28 sm:w-28"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-200 text-xs text-gray-400 sm:h-28 sm:w-28 dark:bg-gray-700"
                    >
                      <Star className="h-6 w-6" />
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/podcast/${podcast.id}`}
                    className="block truncate text-base font-bold text-gray-900 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:text-lg dark:text-gray-100 dark:hover:text-indigo-400"
                  >
                    {podcast.title}
                  </Link>

                  {podcast.author && (
                    <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400">
                      {t('by')} {podcast.author}
                    </p>
                  )}

                  {podcast.lastUpdateTime ? (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {t('latestUpdate')}: {new Date(podcast.lastUpdateTime * 1000).toDateString()}
                    </p>
                  ) : null}

                  {categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {categories.slice(0, 4).map((name) => (
                        <span
                          key={name}
                          className="rounded-md border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleToggleFavorite(podcast)}
                    aria-label={isFavorite ? t('removeFavorite', { title: podcast.title }) : t('addFavorite', { title: podcast.title })}
                    title={isFavorite ? t('removeFavorite', { title: podcast.title }) : t('addFavorite', { title: podcast.title })}
                    aria-pressed={isFavorite}
                    className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-gray-500 dark:hover:bg-gray-800"
                  >
                    <Star className={`h-5 w-5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => playFirstEpisode(String(podcast.id))}
                    disabled={isPending}
                    aria-label={t('play')}
                    title={t('play')}
                    className="rounded p-2 text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-gray-800"
                  >
                    <Play className={`h-5 w-5 ${isPending ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </div>

              {podcast.description && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                  {podcast.description}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center pt-6">
          <button
            onClick={revealMore}
            className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('loadMore')}
          </button>
        </div>
      )}
    </section>
  );
}