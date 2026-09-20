'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFavorites, removeFavorite, type FavoriteItem, type FavoriteType } from '@/lib/favoritesStore';

export default function FavoritesList() {
  const t = useTranslations('home');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  const handleRemove = async (type: FavoriteType, id: string | number) => {
    await removeFavorite(type, id);
    setFavorites((current) =>
      current.filter((item) => !(item.type === type && item.id === id))
    );
  };

  const podcastFavorites = favorites.filter((item) => item.type === 'podcast');
  const liveFavorites = favorites.filter((item) => item.type === 'live');
  const peertubeFavorites = favorites.filter((item) => item.type === 'peertube');

  const renderSection = (
    title: string,
    items: FavoriteItem[],
    type: FavoriteType,
    hrefPrefix: string
  ) => {
    if (items.length === 0) return null;
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {items.map((item) => {
            const href = type === 'live'
              ? `${hrefPrefix}?favorite=true&active=${item.id}`
              : `${hrefPrefix}/${item.id}`;
            const displayTitle = item.title || String(item.id);

            return (
              <li key={item.key} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-4">
                  <img
                    className="w-12 h-12 rounded-full object-cover"
                    src={item.image || '/radio_list/img/music_note_black_48dp.svg'}
                    alt={displayTitle}
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400">
                      {displayTitle}
                    </Link>
                  </div>
                  <button
                    onClick={() => handleRemove(type, item.id)}
                    aria-label={t('favoritesRemove')}
                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  const allEmpty = favorites.length === 0;

  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold">{t('favoritesTitle')}</h2>
      </div>

      {allEmpty ? (
        <div className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
          {t('favoritesEmpty')}
        </div>
      ) : (
        <div className="p-4">
          {renderSection(t('podcast'), podcastFavorites, 'podcast', '/podcast')}
          {renderSection(t('liveTV'), liveFavorites, 'live', '/live')}
          {renderSection(t('peertube'), peertubeFavorites, 'peertube', '/peertube')}
        </div>
      )}
    </section>
  );
}
