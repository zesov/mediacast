'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FeaturedItem } from '../../app/types';
import { usePlayFirstEpisode } from '@/hooks/usePlayFirstEpisode';
import FeaturedCarousel from './FeaturedCarousel';

export default function FeaturedSection({ data }: { data: FeaturedItem[] }) {
  const t = useTranslations('home');
  const { playFirstEpisode, error } = usePlayFirstEpisode();

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{t('featured')}</h2>
        <Link href="/podcast" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-sm font-medium">
          {t('viewAll')}
        </Link>
      </div>
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <FeaturedCarousel featuredItems={data} onPlay={playFirstEpisode} />
    </section>
  );
}