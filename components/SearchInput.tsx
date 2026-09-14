"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import PeerTubeFiltersComp, { PeerTubeFiltersRef } from "@/components/PeerTube/PeerTubeFilters";
import type { PeerTubeFilters } from "@/app/types";

function PeertubeSearchFilters({
  isPeertubePage,
  isPeertubeFiltersOpen,
  setIsPeertubeFiltersOpen,
  peertubeFiltersRef,
}: {
  isPeertubePage: boolean;
  isPeertubeFiltersOpen: boolean;
  setIsPeertubeFiltersOpen: (open: boolean) => void;
  peertubeFiltersRef: React.RefObject<PeerTubeFiltersRef | null>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("peertube.filters");

  const handleApplyFilters = useCallback((filters: Partial<PeerTubeFilters>) => {
    const filterParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
        if (Array.isArray(value)) {
          filterParams.set(key, value.join(','));
        } else {
          filterParams.set(key, String(value));
        }
      }
    });
    const queryString = filterParams.toString();
    const currentSearch = searchParams.get('search') || '';
    router.push(`/peertube?search=${encodeURIComponent(currentSearch)}${queryString ? `&${queryString}` : ''}`);
    setIsPeertubeFiltersOpen(false);
  }, [router, searchParams, setIsPeertubeFiltersOpen]);

  if (!isPeertubePage || !isPeertubeFiltersOpen) return null;

  return (
    <div className="absolute top-full left-0 right-0 sm:right-0 sm:left-auto z-50 mt-1 w-full sm:w-auto sm:min-w-250 max-w-none sm:max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto bg-white dark:bg-gray-900 p-0 sm:max-h-[80vh]">
      <PeerTubeFiltersComp
        ref={peertubeFiltersRef}
        initialFilters={{
          sort: (searchParams.get('sort') as PeerTubeFilters["sort"]) || '-match',
          nsfw: searchParams.get('nsfw') ? searchParams.get('nsfw') === 'true' : null,
          resultType: (searchParams.get('resultType') as PeerTubeFilters["resultType"]) || 'videos',
          isLive: searchParams.get('isLive') ? searchParams.get('isLive') === 'true' : null,
          publishedDateRange: (searchParams.get('publishedDateRange') as PeerTubeFilters["publishedDateRange"]) || 'any_published_date',
          durationRange: (searchParams.get('durationRange') as PeerTubeFilters["durationRange"]) || 'any_duration',
          categoryOneOf: searchParams.get('categoryOneOf') || '',
          licenceOneOf: searchParams.get('licenceOneOf') || '',
          languageOneOf: searchParams.get('languageOneOf') || '',
          tagsAllOf: searchParams.get('tagsAllOf') ? searchParams.get('tagsAllOf')!.split(',') : [],
          tagsOneOf: searchParams.get('tagsOneOf') ? searchParams.get('tagsOneOf')!.split(',') : [],
          host: searchParams.get('host') || '',
        }}
        onApply={handleApplyFilters}
      />
    </div>
  );
}

interface Props {
  peertubeFiltersRef: React.RefObject<PeerTubeFiltersRef | null>;
  onPeertubeFiltersOpenChange: (open: boolean) => void;
}

export default function SearchInput({
  peertubeFiltersRef,
  onPeertubeFiltersOpenChange,
}: Props) {
  const t = useTranslations("navbar");
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isPeertubeFiltersOpen, setIsPeertubeFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLivePage = pathname?.startsWith("/live");
  const isPeertubePage = pathname?.startsWith("/peertube");
  const isFreeTvPage = pathname?.startsWith("/live/free-tv");

  // Sync internal state with external callback
  useEffect(() => {
    onPeertubeFiltersOpenChange(isPeertubeFiltersOpen);
  }, [isPeertubeFiltersOpen, onPeertubeFiltersOpenChange]);

  // Click outside to close peertube filters dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      const isOutsideSearchInput = searchInputRef.current && !searchInputRef.current.contains(target);
      if (isOutsideDropdown && isOutsideSearchInput) {
        setIsPeertubeFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentFilters?: any) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (!searchTerm.trim()) return;

        const term = searchTerm.trim();
if (isFreeTvPage) {
        // Build URL with search parameter, preserving existing category if any
        const params = new URLSearchParams({ search: term });
        // Note: We don't preserve category here because free-tv search should show all matching channels
        // regardless of category. The user can still use category buttons after search.
        router.push(`/live/free-tv?${params.toString()}`);
      } else if (isLivePage) {
        router.push(`/live?search=${encodeURIComponent(term)}`);
      } else if (isPeertubePage) {
        const filters = currentFilters ?? peertubeFiltersRef.current?.getFilters() ?? {};
        const filterParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
            if (Array.isArray(value)) {
              filterParams.set(key, value.join(','));
            } else {
              filterParams.set(key, String(value));
            }
          }
        });
        const queryString = filterParams.toString();
        router.push(`/peertube?search=${encodeURIComponent(term)}${queryString ? `&${queryString}` : ''}`);
      } else {
        router.push(`/podcast/?tag=${encodeURIComponent(term)}`);
      }
      }
    },
    [searchTerm, isLivePage, isPeertubePage, peertubeFiltersRef, router]
  );

  const placeholder =
    isLivePage && !isFreeTvPage
      ? t("liveSearchPlaceholder")
      : isPeertubePage
      ? "Search PeerTube videos…"
      : isFreeTvPage
      ? "Search Free TV channels…"
      : t("searchPlaceholder");

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative rounded-md shadow-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </div>
        <input
          ref={searchInputRef}
          type="search"
          inputMode="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full min-w-0 flex-1 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md leading-5 bg-white dark:bg-gray-900 placeholder-gray-500 sm:text-sm"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => isPeertubePage && setIsPeertubeFiltersOpen(true)}
          onClick={() => isPeertubePage && setIsPeertubeFiltersOpen(true)}
        />
      </div>

      {/* Peertube Filters Dropdown */}
      <Suspense fallback={null}>
        <PeertubeSearchFilters
          isPeertubePage={isPeertubePage}
          isPeertubeFiltersOpen={isPeertubeFiltersOpen}
          setIsPeertubeFiltersOpen={setIsPeertubeFiltersOpen}
          peertubeFiltersRef={peertubeFiltersRef}
        />
      </Suspense>
    </div>
  );
}