import { NextRequest, NextResponse } from "next/server";
import type { PeerTubeSearchResponse, PeerTubeVideo } from "@/app/types";

const SEPIA_BASE = "https://sepiasearch.org/api/v1/search/videos"; // SepiaSearch base URL for PeerTube videos

interface SepiaRawVideo {
  uuid: string;
  name: string;
  description?: string;
  duration: number;
  host: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  category?: { label?: string };
  language?: { label?: string };
  tags?: string[];
  channel?: { displayName?: string };
  account?: { displayName?: string };
  createdAt?: string;
  updatedAt?: string;
  views?: number;
}

function normalize(v: SepiaRawVideo): PeerTubeVideo {
  const embed =
    v.embedUrl ||
    (v.host ? `https://${v.host}/videos/embed/${v.uuid}` : "");
  return {
    uuid: v.uuid,
    name: v.name,
    description: v.description || "",
    duration: v.duration || 0,
    host: v.host,
    embedUrl: embed,
    thumbnailUrl: v.thumbnailUrl,
    previewUrl: v.previewUrl,
    channelDisplayName: v.channel?.displayName || v.account?.displayName || "",
    accountDisplayName: v.account?.displayName || "",
    categoryLabel: v.category?.label,
    languageLabel: v.language?.label,
    tags: v.tags || [],
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    views: v.views || 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // 空搜索时省略 search 参数 —— SepiaSearch 会返回全部/热门视频（聚合视图）
    const rawSearch = (searchParams.get("search") || "").trim();
    const start = parseInt(searchParams.get("start") || "0", 10) || 0;
    const count = Math.min(
      parseInt(searchParams.get("count") || "6", 10) || 6,
      48,
    );

    const qs = new URLSearchParams({
      start: String(start),
      count: String(count),
      searchTarget: "search-index",
      sort: searchParams.get("sort") || "-hot",
      nsfw: "false",
    });
    qs.append("boostLanguages", "zh");
    qs.append("boostLanguages", "en");
    if (rawSearch) {
      qs.set("search", rawSearch);
    }

    // 转发可选的筛选参数（与 PeerTube/SepiaSearch 搜索过滤器一一对应）
    const filterParams = [
      "nsfw",
      "isLive",
      "durationMin",
      "durationMax",
      "startDate",
      "endDate",
      "categoryOneOf",
      "licenceOneOf",
      "languageOneOf",
      "tagsAllOf",
      "tagsOneOf",
      "host",
      "boostLanguages",
    ];
    for (const key of filterParams) {
      const value = searchParams.get(key);
      if (value) qs.set(key, value);
    }

    console.log(`Fetching PeerTube videos from SepiaSearch: ${SEPIA_BASE}?${qs.toString()}`);

    const res = await fetch(`${SEPIA_BASE}?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "SepiaSearch 请求失败" },
        { status: res.status },
      );
    }

    const raw = (await res.json()) as { total: number; data: SepiaRawVideo[] };
    const payload: PeerTubeSearchResponse = {
      total: raw.total,
      data: raw.data.map(normalize),
    };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch PeerTube videos" },
      { status: 500 },
    );
  }
}
