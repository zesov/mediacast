'use client';
import {TopPodcast} from "../../app/types";
import { useEpisode } from '../../app/contexts/EpisodeContext';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { addFavorite, removeFavorite, getFavorites, type FavoriteType } from '@/lib/favoritesStore';

function createFavorite(podcast: TopPodcast) {
  return {
    type: 'podcast' as FavoriteType,
    id: podcast.id,
    title: podcast.title,
    description: podcast.description,
    image: podcast.image,
    lastUpdateTime: podcast.lastUpdateTime,
    addedAt: Date.now(),
  };
}

export default function TopPodcasts({data}:{data:TopPodcast[]}) {
  const t = useTranslations('home');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    getFavorites().then((list) => {
      setFavorites(new Set(list.map((item) => item.id as number)));
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

  const topPodcasts = data;
  const { setCurrentEpisode, setToPlay } = useEpisode();
  const handleClick = async (item: TopPodcast) => {
    const res = await fetch(`/api/episodesByFeedId?id=${item.id}`)
    const episodes = await res.json();    
    setCurrentEpisode(episodes[0]);
    setToPlay(true);
  };  
  return (
    <section className="mb-8 mt-8">
      <h2 className="text-xl font-bold mb-4">{t('topPodcasts')}</h2>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {topPodcasts.map((podcast, index) => (
            <li key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div className="flex items-center">
                <span className="text-gray-500 dark:text-gray-400 w-6 text-center">{index + 1}</span>
                <img className="w-12 h-12 rounded-full" src={podcast.image} alt={podcast.title} />
                <div className="ml-4 flex-1">
                 <Link href={`/podcast/${podcast.id}`}>
                   <h3 className="font-medium">{podcast.title}</h3>
                 </Link>
                 <p className="text-sm text-gray-500 dark:text-gray-400">{t('latestUpdate')}: {(new Date(podcast.lastUpdateTime*1000)).toDateString()}</p>
               </div>
                 <button
                   className={`px-2 ${favorites.has(podcast.id) ? 'text-yellow-500' : 'text-indigo-600 dark:text-indigo-400'} hover:text-indigo-800`}
                   onClick={() => handleToggleFavorite(podcast)}
                   title={favorites.has(podcast.id) ? t('topPodcastsRemoveFromFavorites') : t('topPodcastsAddToFavorites')}
                 >
                   <i className={`fas fa-star ${favorites.has(podcast.id) ? 'text-yellow-500' : ''}`}></i>
                 </button>
                 <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
                   onClick={() => handleClick(podcast)}
                 >
                   <i className="fas fa-play"></i>
                 </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}