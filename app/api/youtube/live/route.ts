import { NextRequest, NextResponse } from 'next/server';
import { assertAllowedHostname, assertPublicHttpUrl, safeFetch } from '@/lib/urlGuard';

interface YoutubeLiveResult {
  channelId?: string;
  videoId?: string;
  embedUrl: string;
  name: string;
  isLive: boolean;
}

const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

// 主頻道 ID 只出現在 metadata 區的 channelUrl（權威、唯一；gridChannelRenderer 是推薦頻道，不可用）
// 影片頁面會用 externalChannelId
const CHANNEL_URL_RE = /"channelUrl":"https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/;
// fallback：影片頁面使用 externalChannelId，或頁面缺 channelUrl 時用 externalId / browseId
const EXTERNAL_CHANNEL_ID_RE = /"externalChannelId":"(UC[\w-]{22})"/;
const EXTERNAL_ID_RE = /"externalId":"(UC[\w-]{22})"/;

function extractChannelId(html: string): string | null {
  const m = html.match(CHANNEL_URL_RE) ?? html.match(EXTERNAL_CHANNEL_ID_RE) ?? html.match(EXTERNAL_ID_RE);
  return m ? m[1] : null;
}

// og:title 形如 "FRANCE 24 English - YouTube"
function extractName(html: string): string {
  const m =
    html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/) ??
    html.match(/<meta property="og:title" content="([^"]+)"/) ??
    html.match(/"og:title":"([^"]+)"/) ??
    html.match(/<title>([^<]*)<\/title>/);
  if (!m) return 'YouTube';
  return m[1].replace(/\s*-\s*YouTube$/, '').trim();
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 });
  try {
    assertAllowedHostname(new URL(url).hostname, YOUTUBE_HOSTS);
    assertPublicHttpUrl(url);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  // 1) 先從 URL 直接提取 videoId（適用於 /watch?v=... 格式）
  let videoId: string | null = null;
  try {
    const u = new URL(url);
    videoId = u.searchParams.get('v');
    // youtu.be/VIDEO_ID
    if (!videoId && u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1);
    }
  } catch {
    // ignore
  }

  // 2) 拉取 HTML 獲取頻道名稱、channelId、live 狀態
  // 剝離 /live 後綴：直播頁缺 channelUrl metadata，頻道主頁才有；是否在播由 embed 自行判斷
  const normalized = url.replace(/\/live\/?$/, '');

  try {
    const { response: res } = await safeFetch(normalized, {
      init: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept-Language': 'en',
        },
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed: ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const channelId = extractChannelId(html);
    const name = extractName(html);

    // 檢測是否為直播：頁面含有 isLive/直播標記
    const isLiveStream = /"isLive":true/.test(html) || /"isLiveContent":true/.test(html) || /直播中/.test(html);

    // 3) 決定 embed URL
    // - 若有 videoId 且非直播，用 video embed
    // - 否則用 channel live_stream embed（需 channelId）
    let embedUrl: string;
    let isLive = false;

    if (videoId && !isLiveStream) {
      // 普通影片：用標準 video embed
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`;
    } else if (channelId) {
      // 直播或無 videoId：用頻道 live_stream embed
      embedUrl =
        `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}` +
        `&autoplay=1&mute=1`;
      isLive = true;
    } else if (videoId) {
      // 有 videoId 但可能是直播影片（首播/正在直播），仍用 video embed
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`;
    } else {
      return NextResponse.json({ error: 'could not resolve embed url' }, { status: 422 });
    }

    const result: YoutubeLiveResult = {
      channelId: channelId || undefined,
      videoId: videoId || undefined,
      embedUrl,
      name,
      isLive,
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error('youtube live resolve failed', e);
    return NextResponse.json({ error: 'resolve failed' }, { status: 502 });
  }
}