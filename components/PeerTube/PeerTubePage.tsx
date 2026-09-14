"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import type { PeerTubeVideo } from "@/app/types";
import type { PeerTubeFilters as PeerTubeFiltersType } from "@/app/types";
import PeerTubeVideoCard from "./PeerTubeVideoCard";
import PeerTubePlayer from "./PeerTubePlayer";
import { X, Search, SlidersHorizontal } from "lucide-react";

interface Props {
  initialVideos: PeerTubeVideo[];
  initialTotal?: number;
  searchTerm?: string;
  filters?: Partial<PeerTubeFiltersType>;
}

const DEFAULT_FILTERS: PeerTubeFiltersType = {
  sort: "-hot",
  nsfw: null,
  resultType: "videos",
  isLive: null,
  publishedDateRange: "any_published_date",
  durationRange: "any_duration",
  categoryOneOf: "",
  licenceOneOf: "",
  languageOneOf: "",
  tagsAllOf: [],
  tagsOneOf: [],
  host: "",
  boostLanguages: undefined,
};

function filtersToQueryParams(filters: Partial<PeerTubeFiltersType>): URLSearchParams {
  const qs = new URLSearchParams();
  if (filters.sort) qs.set("sort", filters.sort);
  if (filters.nsfw !== null) qs.set("nsfw", String(filters.nsfw));
  if (filters.isLive !== null) qs.set("isLive", String(filters.isLive));
  if (filters.publishedDateRange && filters.publishedDateRange !== "any_published_date") {
    const now = new Date();
    let startDate: string | undefined;
    switch (filters.publishedDateRange) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        break;
      case "last_7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "last_30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "last_365days":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }
    if (startDate) qs.set("startDate", startDate);
  }
  if (filters.durationRange && filters.durationRange !== "any_duration") {
    switch (filters.durationRange) {
      case "short":
        qs.set("durationMax", "240");
        break;
      case "medium":
        qs.set("durationMin", "240");
        qs.set("durationMax", "600");
        break;
      case "long":
        qs.set("durationMin", "600");
        break;
    }
  }
  if (filters.categoryOneOf) qs.set("categoryOneOf", filters.categoryOneOf);
  if (filters.licenceOneOf) qs.set("licenceOneOf", filters.licenceOneOf);
  if (filters.languageOneOf) qs.set("languageOneOf", filters.languageOneOf);
  if (filters.tagsAllOf?.length) qs.set("tagsAllOf", filters.tagsAllOf.join(","));
  if (filters.tagsOneOf?.length) qs.set("tagsOneOf", filters.tagsOneOf.join(","));
  if (filters.host) qs.set("host", filters.host);
  return qs;
}

export default function PeerTubePage({ initialVideos, initialTotal = 0, searchTerm = "", filters = {} }: Props) {
  const t = useTranslations("peertube");
  const format = useFormatter();
  const [videos, setVideos] = useState<PeerTubeVideo[]>(initialVideos);
  const [total, setTotal] = useState(initialTotal);
  const [submittedQuery, setSubmittedQuery] = useState(searchTerm);
  const [selected, setSelected] = useState<PeerTubeVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mergedFilters = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...filters }),
    [filters]
  );

  const runSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const filterParams = filtersToQueryParams(mergedFilters);
      const baseUrl = `/api/peertube?search=${encodeURIComponent(query)}&start=0&count=6`;
      const fullUrl = `${baseUrl}&${filterParams.toString()}`;

      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      setVideos(data.data || []);
      setTotal(data.total || 0);
      setSubmittedQuery(query);
    } catch {
      setError(t("searchError"));
    } finally {
      setLoading(false);
    }
  }, [mergedFilters, t]);

  // Run search on mount if searchTerm is provided
  useEffect(() => {
    if (searchTerm) {
      runSearch(searchTerm);
    }
  }, [searchTerm, runSearch]);

  const handleSelect = (video: PeerTubeVideo) => {
    setSelected(video);
    const el = document.getElementById("peertube-player");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {t("title")} 🎬
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* Search status - shows current search query if any */}
      {submittedQuery && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Searching for: <strong>{submittedQuery}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => window.history.pushState({}, "", "/peertube")}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-3 w-3" />
            {t("clearSearch")}
          </button>
        </div>
      )}

      {/* 内联播放器 */}
      {selected && (
        <div id="peertube-player" className="mb-6 scroll-mt-20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
              {selected.name}
            </h2>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✕ {t("close")}
            </button>
          </div>
          <PeerTubePlayer video={selected} />
        </div>
      )}

      {/* 状态提示 */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!error && !loading && videos.length === 0 && !submittedQuery && (
        <div className="mb-4 p-8 text-center rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
          {t("initialEmpty")}
        </div>
      )}
      {!error && !loading && videos.length === 0 && submittedQuery && (
        <div className="mb-4 p-8 text-center rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
          {t("emptyResult", { query: submittedQuery })}
        </div>
      )}

      {/* 主内容区：视频网格 */}
      <main className="flex-1 min-w-0">
          {videos.length > 0 && (
            <>
              <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                {t("resultCount", { count: format.number(total) })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {videos.map((video) => (
                  <PeerTubeVideoCard
                    key={video.uuid}
                    video={video}
                    active={selected?.uuid === video.uuid}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </>
          )}
          {!error && !loading && videos.length === 0 && !submittedQuery && (
            <div className="mb-4 p-8 text-center rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
              {t("initialEmpty")}
            </div>
          )}
          {!error && !loading && videos.length === 0 && submittedQuery && (
            <div className="mb-4 p-8 text-center rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
              {t("emptyResult", { query: submittedQuery })}
            </div>
          )}
        </main>
    </div>
  );
}