import { EpisodeProvider } from '@/app/contexts/EpisodeContext';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import Navbar from '@/components/Navbar';
import FavoritesList from '@/components/FavoritesList';

interface Props {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function FavoritesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Navbar />
      <EpisodeProvider>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <FavoritesList />
        </div>
      </EpisodeProvider>
    </>
  );
}
