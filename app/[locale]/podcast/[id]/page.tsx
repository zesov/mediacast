import { EpisodeProvider } from '@/app/contexts/EpisodeContext';
import EpisodePage from '@/components/Podcast/EpisodeFeed';
import Navbar  from '@/components/Navbar';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

interface Props {
  params: Promise<{ id: number; locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function EpisodeFeedPage({ params }: Props) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  return (
    <>
    <Navbar />
      <EpisodeProvider>
        <EpisodePage key={id} id={id} />
      </EpisodeProvider>
    </>
  );
}
