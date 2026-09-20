import React, { useState, useEffect } from 'react';
// @ts-expect-error react-slick does not ship TypeScript declarations
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import {FeaturedItem} from '../../app/types';
import { useEpisode } from '../../app/contexts/EpisodeContext';
import { useTranslations } from 'next-intl';
import { addFavorite, removeFavorite, getFavorites, type FavoriteType } from '@/lib/favoritesStore';

function createFavorite(item: FeaturedItem) {
  return {
    type: 'podcast' as FavoriteType,
    id: item.id,
    title: item.title,
    description: item.description,
    image: item.image,
    lastUpdateTime: item.lastUpdateTime,
    newestItemPublishTime: item.newestItemPublishTime,
    addedAt: Date.now(),
  };
}

const FeaturedCarousel = ({ featuredItems }: {featuredItems: FeaturedItem[]}) => {
  const t = useTranslations('home');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    getFavorites().then((list) => {
      setFavorites(new Set(list.map((item) => item.id as number)));
    });
  }, []);

  const handleToggleFavorite = async (item: FeaturedItem) => {
    if (favorites.has(item.id)) {
      await removeFavorite('podcast', item.id);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } else {
      await addFavorite(createFavorite(item));
      setFavorites((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    }
  };

  const sliderSettings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    arrows: true,
    autoplay: false,
    beforeChange: (oldIndex: number, newIndex: number) => setCurrentSlide(newIndex),
    appendDots: (dots: React.ReactElement[]) => (
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {dots}
      </div>
    ),
    customPaging: (i:number) => (
      <button
        type="button"
        className={`w-3 h-3 rounded-full ${i === currentSlide ? 'bg-white dark:bg-gray-900' : 'bg-gray-500'}`}
      />
    ),
    responsive: [
        {
          breakpoint: 992,
          settings: { slidesToShow: 3, centerPadding: "50px" }
        },
        {
          breakpoint: 768,
          settings: { slidesToShow: 2, centerPadding: "30px" }
        },
        {
          breakpoint: 480,
          settings: { slidesToShow: 1, centerPadding: "20px" }
        }
      ],
  };

  const { currentEpisode, setCurrentEpisode, episodes, setEpisodes, setToPlay } = useEpisode();
  const handleClick = async (item: FeaturedItem) => {
    const res = await fetch(`/api/episodesByFeedId?id=${item.id}`)
    const episodes = await res.json();
    setCurrentEpisode(episodes[0]);
    setToPlay(true);
  };
  return (
    <div className="relative">
      {/* react-slick轮播容器 */}
      <Slider {...sliderSettings}>
        {featuredItems.map((item, index) => (
          <div key={index} className="relative group">
            <div className="aspect-square overflow-hidden rounded-xl">
              <img
                src={item.image || "/radio_list/img/music_note_black_48dp.svg"}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <button
                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center ${favorites.has(item.id) ? 'bg-yellow-400 text-white' : 'bg-gray-800 bg-opacity-60 text-white hover:bg-opacity-80'}`}
                onClick={() => handleToggleFavorite(item)}
                aria-label={favorites.has(item.id) ? t('topPodcastsRemoveFromFavorites') : t('topPodcastsAddToFavorites')}
              >
                <i className={`fas fa-star ${favorites.has(item.id) ? 'text-yellow-300' : 'text-white'}`}></i>
              </button>
              {/* 播放按钮（悬停显示） */}
              <button className="absolute bottom-4 right-4 w-10 h-10 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                 onClick={() => handleClick(item)}
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                </svg>
              </button>
            </div>
            {/* 文字内容 */}
            <div className="p-4">
              <a 
                href={`/podcast/${item.id}`}
                className="font-semibold text-lg mb-1 line-clamp-2 text-black hover:text-indigo-600 transition-colors"
              >
                {item.title}
              </a>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                   {item.newestItemPublishTime ? (new Date(item.newestItemPublishTime * 1000)).toDateString() : '最新更新'}
                 </span>
              </div>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default FeaturedCarousel;