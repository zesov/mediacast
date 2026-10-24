'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface DirectStreamInputProps {
  onPlay: (url: string) => void;
  recentUrls: string[];
  isFav?: (id: string) => Promise<boolean>;
  toggleFav?: (id: string, name?: string) => Promise<void>;
}

export default function DirectStreamInput({ onPlay, recentUrls, isFav, toggleFav }: DirectStreamInputProps) {
  const t = useTranslations('live');
  const [url, setUrl] = useState('');
  const [favStates, setFavStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isFav || !toggleFav) return;
    let cancelled = false;
    recentUrls.forEach(async (u) => {
      const fav = await isFav(u);
      if (!cancelled) setFavStates((prev) => ({ ...prev, [u]: fav }));
    });
    return () => { cancelled = true; };
  }, [recentUrls, isFav]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onPlay(url.trim());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('direct.enterUrl')}
          className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t('direct.play')}
        </button>
      </form>

      {/* Recent URLs */}
      {recentUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('direct.recentUrls')}</p>
          <div className="flex flex-wrap gap-2">
            {recentUrls.map((u) => (
              <div
                key={u}
                className="flex items-center gap-1.5 bg-gray-200 dark:bg-gray-800 rounded px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                <button
                  onClick={() => {
                    setUrl(u);
                    onPlay(u);
                  }}
                  className="text-xs flex-1 text-left text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white truncate max-w-[200px]"
                  title={u}
                >
                  {u.length > 30 ? u.slice(0, 30) + '…' : u}
                </button>
                {toggleFav && isFav && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await toggleFav(u, u);
                      const fav = await isFav(u);
                      setFavStates((prev) => ({ ...prev, [u]: fav }));
                    }}
                    className="flex-shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                    aria-label={favStates[u] ? t('direct.removeFavorite') : t('direct.addFavorite')}
                    title={favStates[u] ? t('direct.removeFavorite') : t('direct.addFavorite')}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={favStates[u] ? '#fbbf24' : 'none'} stroke={favStates[u] ? '#fbbf24' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
