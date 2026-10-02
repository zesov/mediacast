'use client';
import Head from 'next/head'
import { useTranslations } from 'next-intl';
import type { TopPodcast } from '@/app/types';
import TopPodcasts from './TopPodcasts'
import SearchResults from './SearchResults'
import Player from '../Player'
import Footer from '../Footer'

interface Props {
  feeds: TopPodcast[];
  searchTerm?: string;
  tag?: string;
}

export default function PodcastPage({ feeds, searchTerm, tag }: Props) {
  const t = useTranslations('search');

  const heading = searchTerm
    ? t('heading', { term: searchTerm })
    : tag
    ? t('tagHeading', { tag })
    : t('trendingHeading');

  const isSearch = Boolean(searchTerm);

  return (
    <>
    <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-sans">
      <Head>
        <title>JuneAC 播客(CN) - 网页播放器</title>
        <meta name="description" content="Apple Podcasts Web Player" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3">
            {isSearch ? (
              <SearchResults
                key={searchTerm ?? tag ?? 'trending'}
                feeds={feeds}
                heading={heading}
              />
            ) : (
              <TopPodcasts data={feeds} />
            )}
          </div>

          <div className="lg:w-1/3">
            <Player />
          </div>
        </div>
      </div>

      <Footer />
    </div>
    </>
  );
}