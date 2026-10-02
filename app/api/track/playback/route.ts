/**
 * Playback tracking API route
 * POST /api/track/playback - Track playback events (start, heartbeat, end)
 */

import { NextRequest, NextResponse } from 'next/server';
import { hashIp, getClientIp, parseUserAgent, getCountry, generateSessionId } from '@/lib/privacy';
import { isAdminRequest } from '@/lib/security';
import {
  createPlaybackSession,
  updatePlaybackSession,
  endPlaybackSession,
  incrementPlayCount,
  getPlaybackSession,
  type PlaybackSession,
} from '@/lib/analytics';

interface TrackRequest {
  event: 'start' | 'heartbeat' | 'end';
  contentType: 'peertube' | 'podcast' | 'live';
  contentId: string;
  contentTitle?: string;
  sessionId?: string;        // Required for heartbeat/end
  currentTime?: number;      // For heartbeat
  duration?: number;         // For end event
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request
    const body = await request.json() as TrackRequest;
    const { event, contentType, contentId, contentTitle, sessionId, currentTime, duration } = body;
    
    // Validate required fields
    if (!event || !contentType || !contentId) {
      return NextResponse.json(
        { error: 'Missing required fields: event, contentType, contentId' },
        { status: 400 }
      );
    }
    
    if (!['peertube', 'podcast', 'live'].includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid contentType. Must be: peertube, podcast, or live' },
        { status: 400 }
      );
    }

    // contentId is used verbatim in storage keys; an unbounded value would let a
    // caller mint unlimited keys and inflate play counts for arbitrary content.
    if (typeof contentId !== 'string' || contentId.length === 0 || contentId.length > 200) {
      return NextResponse.json(
        { error: 'contentId must be a non-empty string of at most 200 characters' },
        { status: 400 }
      );
    }
    
    // Extract privacy-safe client info
    const ip = getClientIp(request);
    const ipHash = await hashIp(ip);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const { browser, os, device } = parseUserAgent(userAgent);
    const country = getCountry(request);
    const referrer = request.headers.get('referer') || undefined;
    
    const now = Date.now();
    
    switch (event) {
      case 'start': {
        // Create new session
        const newSessionId = generateSessionId();
        
        const session: PlaybackSession = {
          sessionId: newSessionId,
          contentId,
          contentType,
          contentTitle,
          startedAt: now,
          ipHash,
          browser,
          os,
          device,
          country,
          referrer,
          userAgent,
          heartbeatCount: 0,
        };
        
        await createPlaybackSession(session);
        
        // Increment aggregate count
        await incrementPlayCount(contentType, contentId);
        
        return NextResponse.json({ 
          success: true, 
          sessionId: newSessionId 
        });
      }
      
      case 'heartbeat': {
        if (!sessionId) {
          return NextResponse.json(
            { error: 'sessionId required for heartbeat' },
            { status: 400 }
          );
        }
        
        await updatePlaybackSession(contentType, contentId, sessionId, {
          heartbeatCount: 1, // Will be incremented in update
          lastHeartbeatAt: now,
        });
        
        return NextResponse.json({ success: true });
      }
      
      case 'end': {
        if (!sessionId) {
          return NextResponse.json(
            { error: 'sessionId required for end event' },
            { status: 400 }
          );
        }

        // Prefer the client's duration; otherwise derive it from the stored
        // startedAt. currentTime is a playhead offset in seconds, not a
        // timestamp, so it cannot be subtracted from `now`.
        let playbackDuration = duration ?? 0;
        if (duration === undefined) {
          const session = await getPlaybackSession(contentType, contentId, sessionId);
          if (session) {
            playbackDuration = Math.max(0, Math.round((now - session.startedAt) / 1000));
          }
        }

        await endPlaybackSession(contentType, contentId, sessionId, now, playbackDuration);

        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid event type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Playback tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: GET for debugging/analytics dashboard.
// action=count is public (a bare number). stats and sessions return visitor-level
// records — hashed IP, user agent, referrer — and require ADMIN_TOKEN.
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType') as 'peertube' | 'podcast' | 'live' | null;
    const contentId = searchParams.get('contentId');
    const action = searchParams.get('action') || 'count';

    if (action !== 'count' && !isAdminRequest(request.headers)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'stats') {
      const { getGlobalStats } = await import('@/lib/analytics');
      const stats = await getGlobalStats();
      return NextResponse.json(stats);
    }
    
    if (action === 'sessions' && contentType && contentId) {
      const { getContentSessions } = await import('@/lib/analytics');
      const sessions = await getContentSessions(contentType, contentId);
      return NextResponse.json({ sessions });
    }
    
    if (action === 'count' && contentType && contentId) {
      const { getPlayCount } = await import('@/lib/analytics');
      const count = await getPlayCount(contentType, contentId);
      return NextResponse.json({ count });
    }
    
    return NextResponse.json(
      { error: 'Invalid query. Use action=count|sessions|stats with contentType and contentId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Playback tracking GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}