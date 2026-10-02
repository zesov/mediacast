import { NextRequest, NextResponse } from 'next/server';
import { assertAllowedHostname, assertPublicHttpUrl, safeFetch } from '@/lib/urlGuard';

interface YoutubeLiveResult {
  channelId: string;
  embedUrl: string;
  name: string;
}

const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

// 主頻道 ID 只出現在 metadata 區的 channelUrl（權威、唯一；gridChannelRenderer 是推薦頻道，不可用）
const CHANNEL_URL_RE = /"channelUrl":"https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/;
// fallback：頁面缺 channelUrl 時用 externalId / browseId
const EXTERNAL_ID_RE = /"externalId":"(UC[\w-]{22})"/;

function extractChannelId(html: string): string | null {
  const m = html.match(CHANNEL_URL_RE) ?? html.match(EXTERNAL_ID_RE);
  return m ? m[1] : null;
}

// og:title 形如 "FRANCE 24 English - YouTube"
function extractName(html: string): string {
  const m =
    html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/) ??
    html.match(/<meta property="og:title" content="([^"]+)"/) ??
    html.match(/"og:title":"([^"]+)"/) ??
    html.match(/<title>([^<]*)<\/title>/);
  if (!m) return 'YouTube Live';
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
  // 剝離 /live 後綴：直播頁缺 channelUrl metadata，頻道主頁才有；是否在播由 embed 自行判斷
  const normalized = url.replace(/\/live\/?$/, '');

  try {
    const { response: res } = await safeFetch(normalized, {
      init: {
        headers: {
          // youtube 需要瀏覽器 UA，否則回傳 consent / 錯誤頁
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
    if (!channelId) {
      return NextResponse.json({ error: 'could not resolve channel id' }, { status: 422 });
    }

    const embedUrl =
      `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}` +
      `&autoplay=1&mute=1`;
    const result: YoutubeLiveResult = {
      channelId,
      embedUrl,
      name: extractName(html),
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error('youtube live resolve failed', e);
    return NextResponse.json({ error: 'resolve failed' }, { status: 502 });
  }
}