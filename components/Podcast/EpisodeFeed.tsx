'use client'
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Episode } from "../../app/types";
import { useEpisode } from '../../app/contexts/EpisodeContext';
import { useTranslations } from 'next-intl';
import Player from '../Player';
import { useRouter } from 'next/navigation';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { Play, Pause } from 'lucide-react';

interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  image: string;
  category: string;
  episodes: Episode[];
}
const fetchData = async (id: number) => {
  const podcast = await fetch(`/api/podcastById?id=${id}`);
  const res = await fetch(`/api/episodesByFeedId?id=${id}&max=50`);
  return {
    podcast: await podcast.json(),
    episodes: await res.json(),
  };
}
export default function EpisodePage({id}: {id:number}) {
  const t = useTranslations('episode');
  const episodeId = id;
  const router = useRouter();

  const { currentEpisode, setCurrentEpisode, episodes, setEpisodes, setToPlay, isPlaying } = useEpisode();
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const { visibleCount, hasMore, revealMore, sentinelRef } = useInfiniteReveal(podcast?.episodes.length ?? 0);

  const handleClick = async (item: Episode) => {
    setCurrentEpisode(item);
    setToPlay(true);
  };  
  // 模拟数据获取
  useEffect(() => {
    fetchData(episodeId).then(res=>{
      const {podcast, episodes} = res;
      setPodcast({...podcast.feed, episodes});
      setCurrentEpisode(episodes[0]);
    });
  }, [episodeId]);

  if (!podcast || !currentEpisode) {
    return <div className="flex justify-center items-center min-h-screen">{t('loading')}</div>;
  }

  return (
    <>
      <Head>
        <title>{currentEpisode.title} - {podcast.title}</title>
        <meta name="description" content={currentEpisode.description} />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* 导航栏 */}
        <nav className="bg-white dark:bg-gray-900 shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
              <button 
                onClick={() => {router.back()}} 
                className="mr-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                </button>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{podcast.title}</h1>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 播客信息头部 */}
          <div className="flex flex-col md:flex-row items-start space-y-6 md:space-y-0 md:space-x-8 mb-12">
            <div className="flex-shrink-0">
              <img
                src={podcast.image}
                alt={podcast.title}
                width={300}
                height={300}
                className="rounded-2xl shadow-lg"
              />
            </div>
            
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">{currentEpisode.title}</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">{podcast.author}</p>
              
              <div className="flex items-center space-x-4 mb-6">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                  {podcast.category}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">{currentEpisode.datePublishedPretty}</span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">{currentEpisode.duration}</span>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                {currentEpisode.description}
              </p>

              {/* 播放控制 */}
              <Player title={false}/>
            </div>
          </div>

          {/* 剧集列表 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b flex items-baseline justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('allEpisodes')}</h3>
              <span className="text-xs tabular-nums tracking-wide text-gray-500 dark:text-gray-400">
                {t('count', { shown: visibleCount, total: podcast.episodes.length })}
              </span>
            </div>
            
            <div className="divide-y">
              {podcast.episodes.slice(0, visibleCount).map((episode, index) => (
                <div
                  key={episode.id}
                  className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                    episode.id === currentEpisode.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleClick(episode)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <img src={episode.image} className="text-gray-500 dark:text-gray-400 font-medium"></img>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {episode.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{episode.datePublishedPretty} • {episode.duration}</p>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{episode.description}</p>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentEpisode?.id === episode.id && isPlaying) {
                          // 暂停当前播放中的剧集（Player 监听原生 pause 事件同步状态）
                          document.querySelector<HTMLAudioElement>('audio.episode-player-audio')?.pause();
                          return;
                        }
                        handleClick(episode);
                      }}
                      aria-label={currentEpisode?.id === episode.id && isPlaying ? t('pause', { title: episode.title }) : t('play', { title: episode.title })}
                      title={currentEpisode?.id === episode.id && isPlaying ? t('pause', { title: episode.title }) : t('play', { title: episode.title })}
                      className="h-12 w-12 shrink-0 rounded-full bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 flex items-center justify-center dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                      {currentEpisode?.id === episode.id && isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                <button
                  onClick={revealMore}
                  className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {t('loadMore')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// 辅助函数：格式化时间
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}