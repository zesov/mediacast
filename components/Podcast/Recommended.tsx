'use client';
import { useEpisodeActions } from '../../app/contexts/EpisodeContext';
import { useTranslations } from 'next-intl';
import React, { useEffect } from 'react';
import { Episode } from '@/app/types';

export default function Recommended({items}: { items: Episode[] }) {
  const t = useTranslations('home');
  const { setCurrentEpisode, setToPlay } = useEpisodeActions();
  const handleClick = (item: Episode) => {
    setCurrentEpisode(item);
    setToPlay(true);
  };
  useEffect(() => {
    if (items.length > 0) {
      setCurrentEpisode(items[0]);
    }
  }, [items, setCurrentEpisode]);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
      <h3 className="font-bold mb-4">{t('recommended')}</h3>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-center relative cursor-pointer"
             onClick={() => handleClick(item)}
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex-shrink-0">
              <img src={item.image || '/music.svg'} alt={item.title} className="w-full h-full rounded-lg" />
            </div>
            <div className="ml-3">
              <h4 className="font-medium text-sm">{item.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.datePublishedPretty}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}