import { NextRequest, NextResponse } from 'next/server';
import { parseM3U8, parseEpgJSON, parseEpgXMLWithChannels, prioritizeEpgUrls, FreeTVChannel } from '@/lib/freeTvParser';

const PLAYLIST_URL = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const EPG_CACHE_DURATION = 15 * 60 * 1000;

const epgCache = new Map<string, { data: any; timestamp: number }>();

let channelsCache: { data: FreeTVChannel[]; timestamp: number } | null = null;

async function getPlaylistChannels(): Promise<FreeTVChannel[]> {
  const now = Date.now();
  if (channelsCache && now - channelsCache.timestamp < 15 * 60 * 1000) {
    return channelsCache.data;
  }
  const response = await fetch(PLAYLIST_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NextPodcast/1.0)' },
  });
  const text = await response.text();
  const channels = parseM3U8(text);
  channelsCache = { data: channels, timestamp: now };
  return channels;
}

async function fetchEpg(urls: string[]): Promise<any[]> {
  for (const url of urls) {
    try {
      const now = Date.now();
      const cached = epgCache.get(url);
      if (cached && now - cached.timestamp < EPG_CACHE_DURATION) {
        return cached.data;
      }

      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; NextPodcast/1.0)',
          'Accept-Encoding': 'gzip, deflate',
        },
      });

      if (!response.ok) {
        continue;
      }

      const contentEncoding = response.headers.get('content-encoding') || '';
      const isGzipped = contentEncoding.includes('gzip') || url.endsWith('.gz');
      
      let text: string;
      if (isGzipped) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        text = gunzipSync(buffer).toString('utf-8');
      } else {
        text = await response.text();
      }

      const contentType = response.headers.get('content-type') || '';
      
      let programs: any[] = [];
      if (contentType.includes('xml') || text.trim().startsWith('<?xml') || text.includes('<tv>')) {
        programs = [{ rawXml: text }];
      } else if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
        programs = [{ rawJson: text }];
      } else {
        continue;
      }

      epgCache.set(url, { data: programs, timestamp: now });
      return programs;
    } catch {
      continue;
    }
  }
  
  throw new Error('All EPG URLs failed');
}

function gunzipSync(buffer: Buffer): Buffer {
  const zlib = require('zlib');
  return zlib.gunzipSync(buffer);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ error: 'channelId required' }, { status: 400 });
    }

    const allChannels = await getPlaylistChannels();
    const channel = allChannels.find(c => c.id === channelId);
    if (!channel?.tvgUrl) {
      return NextResponse.json([], { status: 200 });
    }

    // 优先拉取 channel 所属国家的 EPG 档案（如 HK channel → epg_ripper_HK1.xml.gz）
    const prioritizedUrls = prioritizeEpgUrls(channel.tvgUrl, channel.country);
    const epgData = await fetchEpg(prioritizedUrls);
    const programs: any[] = [];

    for (const item of epgData) {
      if (item.rawXml) {
        const matched = parseEpgXMLWithChannels(item.rawXml, allChannels);
        // parseEpgXMLWithChannels 会返回 XML 里匹配到的所有频道节目，必须按请求的 channelId 过滤
        const forThisChannel = matched.filter(p => p.channelId === channelId);
        console.log(`EPG matched ${forThisChannel.length} programmes for ${channelId}`);
        programs.push(...forThisChannel);
      } else if (item.rawJson) {
        programs.push(...parseEpgJSON(item.rawJson, channelId));
      }
    }

    const epgSlots = programs.map(p => ({
      start: p.start,
      end: p.end,
      title: p.title,
      description: p.description,
      isLive: p.isLive || false,
    }));

    return NextResponse.json(epgSlots);
  } catch (error) {
    console.error('EPG fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch EPG' },
      { status: 500 }
    );
  }
}