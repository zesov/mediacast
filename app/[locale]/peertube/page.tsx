import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import PeerTubePage from "@/components/PeerTube/PeerTubePage";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { PeerTubeSearchResponse } from "@/app/types";
import type { PeerTubeFilters } from "@/app/types";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    search?: string;
    sort?: string;
    nsfw?: string;
    resultType?: string;
    isLive?: string;
    publishedDateRange?: string;
    durationRange?: string;
    categoryOneOf?: string;
    licenceOneOf?: string;
    languageOneOf?: string;
    tagsAllOf?: string;
    tagsOneOf?: string;
    host?: string;
  }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

async function buildBaseUrl(): Promise<string> {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const host = (await headers()).get("host");
  return host ? `http://${host}` : "http://localhost:3000";
}

export default async function PeerTubeHome({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const searchTerm = sp.search || "";
  const filters: Partial<PeerTubeFilters> = {};

  if (sp.sort) filters.sort = sp.sort as PeerTubeFilters["sort"];
  if (sp.nsfw) filters.nsfw = sp.nsfw === "true";
  if (sp.resultType) filters.resultType = sp.resultType as PeerTubeFilters["resultType"];
  if (sp.isLive) filters.isLive = sp.isLive === "true";
  if (sp.publishedDateRange) filters.publishedDateRange = sp.publishedDateRange as PeerTubeFilters["publishedDateRange"];
  if (sp.durationRange) filters.durationRange = sp.durationRange as PeerTubeFilters["durationRange"];
  if (sp.categoryOneOf) filters.categoryOneOf = sp.categoryOneOf;
  if (sp.licenceOneOf) filters.licenceOneOf = sp.licenceOneOf;
  if (sp.languageOneOf) filters.languageOneOf = sp.languageOneOf;
  if (sp.tagsAllOf) filters.tagsAllOf = sp.tagsAllOf.split(",");
  if (sp.tagsOneOf) filters.tagsOneOf = sp.tagsOneOf.split(",");
  if (sp.host) filters.host = sp.host;

  let initial: PeerTubeSearchResponse = { total: 0, data: [] };
  try {
    const filterParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
        if (Array.isArray(value)) {
          filterParams.set(key, value.join(","));
        } else {
          filterParams.set(key, String(value));
        }
      }
    });
    const queryString = filterParams.toString();
    const url = `${await buildBaseUrl()}/api/peertube?search=${encodeURIComponent(searchTerm)}&start=0&count=6${queryString ? `&${queryString}` : ''}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      initial = (await res.json()) as PeerTubeSearchResponse;
    }
  } catch {
    // initial load 失败时静默返回空数据，客户端会展示空状态
  }

  return (
    <>
      <Navbar />
      <PeerTubePage initialVideos={initial.data} initialTotal={initial.total} searchTerm={searchTerm} filters={filters} />
      <Footer />
    </>
  );
}