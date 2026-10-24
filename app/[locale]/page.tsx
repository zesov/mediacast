import { client } from "@/app/api/db";
import Main from "@/components/main";
import { EpisodeProvider } from "@/app/contexts/EpisodeContext";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { FeaturedItem, TopPodcast, Episode } from "@/app/types";

interface Props {
  params: Promise<{ locale: string }>;
}
const categories = [
  "Arts", "Books", "Design", "Fashion", "Beauty", "Food", "Performing", "Visual",
  "Business", "Careers", "Entrepreneurship", "Investing", "Management", "Marketing", "Non‑Profit",
  "Comedy", "Interviews", "Improv", "Stand‑Up",
  "Education", "Courses", "How‑To", "Language", "Learning", "Self‑Improvement",
  "Fiction", "Drama", "History",
  "Health", "Fitness", "Alternative", "Medicine", "Mental", "Nutrition", "Sexuality",
  "Kids", "Family", "Parenting", "Pets", "Animals", "Stories",
  "Leisure", "Animation", "Manga", "Automotive", "Aviation", "Crafts", "Games", "Hobbies", "Home", "Garden", "Video‑Games",
  "Music", "Commentary", "News", "Daily", "Entertainment",
  "Government", "Politics",
  "Buddhism", "Christianity", "Hinduism", "Islam", "Judaism", "Religion", "Spirituality",
  "Science", "Astronomy", "Chemistry", "Earth", "Life", "Mathematics", "Natural", "Nature", "Physics",
  "Social", "Society", "Culture", "Documentary", "Personal", "Journals", "Philosophy", "Places", "Travel", "Relationships",
  "Sports", "Baseball", "Basketball", "Cricket", "Fantasy", "Football", "Golf", "Hockey", "Rugby", "Running", "Soccer", "Swimming", "Tennis", "Volleyball", "Wilderness", "Wrestling",
  "Technology", "True Crime", "TV", "Film", "After‑Shows", "Reviews", "Climate", "Weather", "Tabletop", "Role‑Playing", "Cryptocurrency"
];

/**
 * 随机返回列表中一个单词
 */
function getRandomCategory(): string {
  const randomIndex = Math.floor(Math.random() * categories.length); // 生成一个随机索引
  return categories[randomIndex];
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = getRandomCategory();

  const [searchPodcastsData, trendingPodcastsData, recentEpisodesData, episodesRandomData, categoriesData] =
    await Promise.all([
      client.search(query, { max: 6 }).catch(() => ({ feeds: [] as TopPodcast[], status: "error", count: 0 })),
      client.trending({ max: 8 }).catch(() => ({ feeds: [] as any, status: "error", count: 0 })),
      client.recentEpisodes({ max: 6 }).catch(() => ({ items: [] as Episode[], status: "error", count: 0 })),
      client.episodesRandom({ max: 3 }).catch(() => ({ episodes: [] as Episode[], status: "error", count: 0 })),
      client.categories().catch(() => ({ feeds: [] as { name: string }[], status: "error", count: 0 })),
    ]);

  const { feeds } = trendingPodcastsData; 

  return (
    <EpisodeProvider>
      <Main feeds={feeds} topPodcasts={searchPodcastsData} 
      recentEpisodes={recentEpisodesData} episodesRandom={episodesRandomData} categories={categoriesData}/>
    </EpisodeProvider>
  );
}
