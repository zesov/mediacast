'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface UsePlaybackTrackingOptions {
  contentType: 'peertube' | 'podcast' | 'live';
  contentId: string;
  contentTitle?: string;
  enabled?: boolean;
  heartbeatInterval?: number;
}

interface UsePlaybackTrackingReturn {
  startTracking: (metadata?: { title?: string }) => Promise<string | null>;
  stopTracking: (duration?: number) => Promise<void>;
  heartbeat: (currentTime: number) => Promise<void>;
  sessionId: string | null;
  isTracking: boolean;
}

export function usePlaybackTracking({
  contentType,
  contentId,
  contentTitle,
  enabled = true,
}: UsePlaybackTrackingOptions): UsePlaybackTrackingReturn {
  const sessionIdRef = useRef<string | null>(null);
  const isTrackingRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const beginTracking = useCallback(() => {
    isTrackingRef.current = true;
    setIsTracking(true);
    startedAtRef.current = Date.now();
  }, []);

  const endTracking = useCallback((newSessionId: string | null) => {
    isTrackingRef.current = false;
    setIsTracking(false);
    sessionIdRef.current = newSessionId;
    setSessionId(newSessionId);
    startedAtRef.current = 0;
  }, []);

  const startTracking = useCallback(async (metadata?: { title?: string }) => {
    if (!enabled || isTrackingRef.current) return null;

    beginTracking();

    try {
      const response = await fetch('/api/track/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'start',
          contentType,
          contentId,
          contentTitle: metadata?.title || contentTitle,
        }),
      });

      const data = await response.json();
      const newSessionId = data.sessionId ?? null;
      sessionIdRef.current = newSessionId;
      setSessionId(newSessionId);

      return newSessionId;
    } catch {
      endTracking(null);
      return null;
    }
  }, [enabled, contentType, contentId, contentTitle, beginTracking, endTracking]);

  const heartbeat = useCallback(async (currentTime: number) => {
    if (!enabled || !isTrackingRef.current || !sessionIdRef.current) return;

    try {
      await fetch('/api/track/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'heartbeat',
          contentType,
          contentId,
          sessionId: sessionIdRef.current,
          currentTime,
        }),
      });
    } catch {
      // Tracking must never interrupt playback.
    }
  }, [enabled, contentType, contentId]);

  const stopTracking = useCallback(async (duration?: number) => {
    if (!enabled || !isTrackingRef.current) return;

    const playbackDuration = duration ?? Math.round((Date.now() - startedAtRef.current) / 1000);
    const finishedSessionId = sessionIdRef.current;

    endTracking(null);

    if (!finishedSessionId) return;

    try {
      await fetch('/api/track/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'end',
          contentType,
          contentId,
          sessionId: finishedSessionId,
          duration: playbackDuration,
        }),
        keepalive: true,
      });
    } catch {
      // keepalive requests can be dropped by navigation; nothing to recover.
    }
  }, [enabled, contentType, contentId, endTracking]);

  useEffect(() => {
    return () => {
      if (isTrackingRef.current) {
        void stopTracking();
      }
    };
  }, [stopTracking]);

  return { startTracking, stopTracking, heartbeat, sessionId, isTracking };
}