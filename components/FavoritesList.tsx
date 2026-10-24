'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFavorites, removeFavorite, exportFavorites, importFavorites, type FavoriteItem, type FavoriteType } from '@/lib/favoritesStore';

export default function FavoritesList() {
  const t = useTranslations('home');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  const handleRemove = async (type: FavoriteType, id: string | number) => {
    await removeFavorite(type, id);
    setFavorites((current) =>
      current.filter((item) => !(item.type === type && item.id === id))
    );
  };

  const handleExport = async () => {
    const json = await exportFavorites();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'podcast-favorites.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    if (!text.trim()) {
      setImportError(t('importEmpty'));
      return;
    }
    try {
      const count = await importFavorites(text);
      setFavorites(await getFavorites());
      setShowImport(false);
      setImportError('');
    } catch {
      setImportError(t('importError'));
    } finally {
      // Clear input so same file can be selected again
      if (e.target) e.target.value = '';
    }
  };

  const openImport = () => {
    if (importInputRef.current) {
      importInputRef.current.click();
    }
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
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium"
            >
              {t('favoritesExport')}
            </button>
            <button
              onClick={openImport}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-md text-sm font-medium"
            >
              {t('favoritesImport')}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>
          {importError && (
            <p className="mb-4 text-sm text-red-500">{importError}</p>
          )}
          {renderSection(t('podcast'), podcastFavorites, 'podcast', '/podcast')}
          {renderSection(t('liveTV'), liveFavorites, 'live', '/live')}
          {renderSection(t('peertube'), peertubeFavorites, 'peertube', '/peertube')}
        </div>
      )}
    </section>
  );
}
