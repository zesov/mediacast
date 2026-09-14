export interface FeaturedItem {
  id: number;
  title: string;
  description: string;
  duration?: string;
  image?: string; 
  lastUpdateTime?: number;
  newestItemPublishTime?: number;
}

export interface TopPodcast {
  id: number;
  title: string;
  description: string;
  duration?: string;
  image?: string; 
  lastUpdateTime: number;
}

export interface Episode {
  id: number;
  title: string;
  description: string;
  duration?: string;
  image: string; 
  feedImage: string;
  enclosureType: string;
  datePublishedPretty: string;
  datePublished: number;
  enclosureLength: number;
  enclosureUrl: string;
  feedTitle: string;
}

/**
 * PeerTube 视频（来自 SepiaSearch 归一化后的搜索结果）。
 * PeerTube video (normalized from a SepiaSearch search result).
 */
export interface PeerTubeVideo {
  uuid: string;
  name: string;
  description: string;
  /** 视频时长（秒） */
  duration: number;
  /** 视频所在实例的 host，如 indymotion.fr */
  host: string;
  /** 播放地址 —— 直接作为 <peertube-video> 的 src */
  embedUrl: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  /** 频道显示名，如 Hong Kong */
  channelDisplayName: string;
  /** 账号显示名 */
  accountDisplayName: string;
  /** 分类标签 */
  categoryLabel?: string;
  languageLabel?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  views: number;
}

export interface PeerTubeSearchResponse {
  total: number;
  data: PeerTubeVideo[];
}

/**
 * PeerTube 搜索筛选状态（与 SepiaSearch 过滤器一一对应）。
 * PeerTube search filter state (one-to-one with the SepiaSearch filters).
 */
export interface PeerTubeFilters {
  /** 排序：-match 最佳匹配 / -hot 最热 / -publishedAt 最新 / publishedAt 最旧 */
  sort: "-match" | "-hot" | "-publishedAt" | "publishedAt";
  /** 显示敏感内容：null 未设置，true 是，false 否 */
  nsfw: boolean | null;
  /** 结果类型：videos / channels / playlists */
  resultType: "videos" | "channels" | "playlists";
  /** 仅显示：true 直播 / false 点播 / null 全部 */
  isLive: boolean | null;
  /** 发布日期范围 */
  publishedDateRange:
    | "any_published_date"
    | "today"
    | "last_7days"
    | "last_30days"
    | "last_365days";
  /** 时长范围 */
  durationRange: "any_duration" | "short" | "medium" | "long";
  /** 分类 ID（"any" 表示全部） */
  categoryOneOf: string;
  /** 许可证 ID（"any" 表示全部） */
  licenceOneOf: string;
  /** 语言代码（"any" 表示全部） */
  languageOneOf: string;
  /** "包含所有这些标签" */
  tagsAllOf: string[];
  /** "包含其中任一标签" */
  tagsOneOf: string[];
  /** PeerTube 实例 host */
  host: string;
  /** 优先语言列表（如 ["zh", "en"]） */
  boostLanguages?: string[];
}


