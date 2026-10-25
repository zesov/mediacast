'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'live:recentUrls';
const MAX_RECENT = 5;

interface RecentEntry {
  url: string;
  name?: string;
}

interface DirectStreamReturn {
  recentUrls: string[];
  recentEntries: RecentEntry[];
  playUrl: (url: string, name?: string) => void;
}

export function useDirectStream(): DirectStreamReturn {
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      // 向后兼容：旧格式是纯字符串数组
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        if (typeof parsed[0] === 'string') {
          return parsed.map((u: string) => ({ url: u }));
        }
      }
      return parsed as RecentEntry[];
    } catch {
      return [];
    }
  });

  const playUrl = useCallback((url: string, name?: string) => {
    setRecentEntries((prev) => {
      const next: RecentEntry[] = [{ url, name }, ...prev.filter((e) => e.url !== url)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentUrls: recentEntries.map((e) => e.url), recentEntries, playUrl };
}
