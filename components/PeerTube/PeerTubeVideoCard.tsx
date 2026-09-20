"use client";
import { useState, useEffect, useCallback, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { PeerTubeVideo } from "@/app/types";
import { toggleFavorite, isFavorite } from "@/lib/favoritesStore";

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-HK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

interface Props {
  video: PeerTubeVideo;
  active: boolean;
  onSelect: (video: PeerTubeVideo) => void;
}

export default function PeerTubeVideoCard({ video, active, onSelect }: Props) {
  const t = useTranslations("peertube.videoCard");
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    isFavorite('peertube', video.uuid).then(setIsFav);
  }, [video.uuid]);

  const handleToggleFavorite = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    const fav = await toggleFavorite({
      type: 'peertube',
      id: video.uuid,
      title: video.name,
      description: '',
      image: video.previewUrl || video.thumbnailUrl,
      previewUrl: video.previewUrl,
      uuid: video.uuid,
      addedAt: Date.now(),
    });
    setIsFav(fav);
  }, [video.uuid, video.name, video.previewUrl, video.thumbnailUrl]);

  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className={`group text-left w-full rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm border transition ${
        active
          ? "border-indigo-500 ring-2 ring-indigo-200"
          : "border-gray-200 hover:shadow-md hover:border-indigo-300"
      }`}
    >
      <div className="relative aspect-video bg-gray-200 dark:bg-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.previewUrl || video.thumbnailUrl || "/music.svg"}
          alt={video.name}
          className="w-full h-full object-cover group-hover:opacity-90"
          loading="lazy"
        />
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">
            {formatDuration(video.duration)}
          </span>
        )}
        <div
          onClick={handleToggleFavorite}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleFavorite(e as never);
            }
          }}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <i className={`fas fa-star ${isFav ? 'text-yellow-400' : ''}`}></i>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-indigo-600">
          {video.name}
        </h3>
        {video.accountDisplayName && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {t("publishedBy", { name: video.accountDisplayName })}
            {video.createdAt && ` ${t("onDate", { date: formatDate(video.createdAt) })}`}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
          {t("inChannel", { channel: video.channelDisplayName || video.host })}
        </p>        
        {video.languageLabel && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {t("language", { label: video.languageLabel })}
          </p>
        )}
        {video.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {video.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
