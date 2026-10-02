import { EpisodeProvider } from '@/app/contexts/EpisodeContext';
import { client } from '@/app/api/db';
import Navbar from '@/components/Navbar';
import PodcastPage from '@/components/Podcast/Podcast';
import { resolvePodcastQuery, toTopPodcasts, type RawFeed } from '@/lib/podcastSearch';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

const MAX_RESULTS = 50;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string | string[]; tag?: string | string[] }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PodcastSearchPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const query = resolvePodcastQuery(sp);
  let rawFeeds: RawFeed[] = [];

  if (query.kind === 'search') {
    const result = await client.search(query.term, { max: MAX_RESULTS });
    rawFeeds = result.feeds ?? [];
  } else if (query.kind === 'tag') {
    const result = await client.raw<{ feeds?: RawFeed[] }>('/podcasts/bytag', {
      'podcast-value': query.tag,
      max: MAX_RESULTS,
    });
    rawFeeds = result.feeds ?? [];
  } else {
    const result = await client.trending({ max: MAX_RESULTS });
    rawFeeds = result.feeds ?? [];
  }

  const feeds = toTopPodcasts(rawFeeds);

  return (
    <>
      <Navbar />
      <EpisodeProvider>
        <PodcastPage
          feeds={feeds}
          searchTerm={query.kind === 'search' ? query.term : undefined}
          tag={query.kind === 'tag' ? query.tag : undefined}
        />
      </EpisodeProvider>
    </>
  );
}