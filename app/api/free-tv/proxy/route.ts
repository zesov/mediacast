import { NextRequest, NextResponse } from 'next/server';
import { assertPublicHttpUrl, safeFetch } from '@/lib/urlGuard';
import { createRateLimiter, extractClientIp } from '@/lib/security';

// 直播流代理：解决外部 IPTV 流源（Free-TV 等）不带 CORS 头导致浏览器端 hls.js 无法直连的问题。
// 工作方式：
//   1. 浏览器 hls.js 请求同源 `/api/free-tv/proxy?url=<外部流URL>`
//   2. 服务端 fetch 转发（服务端无 CORS 限制，跟随 302 重定向拿到真实流）
//   3. m3u8 内容做 URL 重写——把相对路径片段（如 cctv1md/segment_x.ts）解析为绝对地址后
//      再包成代理 URL，保证后续片段请求也走同源代理，不被 CORS 拦截。
//   4. TS/TS 片段等二进制直接透传。

const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 防御：单次响应不超过 50MB
const MAX_PLAYLIST_SIZE = 4 * 1024 * 1024;

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

/**
 * 读取响应体并在超过 limit 时中断。content-length 缺失或被伪造时，
 * 唯一可靠的体积上限只能在读取过程中执行。
 */
async function readCapped(response: Response, limit: number): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > limit) return null;

  if (!response.body) {
    const text = await response.text();
    return text.length > limit ? null : text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// 若 URL 为相对路径则基于 base 解析为绝对地址
function resolveUrl(u: string, base: string): string {
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}

function proxyUrlFor(abs: string): string {
  return `/api/free-tv/proxy?url=${encodeURIComponent(abs)}`;
}

// 重写单行 m3u8 内容：
//   - #EXT-X-KEY 的 URI（加密流的密钥）也包一层代理
//   - 非 # 开头的纯 URL 行（片段 / 子播放列表）包一层代理
function rewriteLine(line: string, base: string): string {
  const keyMatch = line.match(/^(#EXT-X-KEY:[^\n]*?URI=")([^"]+)(".*)$/i);
  if (keyMatch) {
    const abs = resolveUrl(keyMatch[2], base);
    return `${keyMatch[1]}${proxyUrlFor(abs)}${keyMatch[3]}`;
  }
  const trimmed = line.trim();
  if (!trimmed.startsWith('#') && trimmed.length > 0) {
    const abs = resolveUrl(trimmed, base);
    return proxyUrlFor(abs);
  }
  return line;
}

// 判断响应是否为 HLS 文本（m3u8 / m3u）——需要做 URL 重写
function isHlsContent(contentType: string | null, url: string): boolean {
  return (
    /mpegurl|m3u8?|application\/vnd\.apple/i.test(contentType || '') ||
    /\.m3u8?(?:$|\?)/i.test(url)
  );
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url') || '';

  if (!limiter.check(extractClientIp(request.headers))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    assertPublicHttpUrl(target);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  try {
    const { response: res, finalUrl } = await safeFetch(target, {
      init: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NextPodcast/1.0)',
          Referer: new URL(target).origin,
        },
        cache: 'no-store',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get('content-type');
    const isPlaylist = isHlsContent(contentType, finalUrl);

    if (isPlaylist) {
      const text = await readCapped(res, MAX_PLAYLIST_SIZE);
      if (text === null) {
        return NextResponse.json({ error: 'playlist too large' }, { status: 413 });
      }

      const rewritten = text
        .split('\n')
        .map((line) => rewriteLine(line, finalUrl))
        .join('\n');
      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    }

    const buf = await readCapped(res, MAX_DOWNLOAD_SIZE);
    if (buf === null) {
      return NextResponse.json({ error: 'response too large' }, { status: 413 });
    }

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 });
  }
}