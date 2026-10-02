'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextVisibleCount, PAGE_SIZE } from '@/lib/podcastSearch';

/**
 * Shared infinite-scroll reveal: renders `pageSize` items, auto-loads more
 * when the sentinel enters the viewport, and exposes a manual fallback for
 * keyboard users. Pair the returned `sentinelRef` with a "load more" button.
 */
export function useInfiniteReveal(total: number, pageSize: number = PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < total;

  const revealMore = useCallback(() => {
    setVisibleCount((prev) => nextVisibleCount(prev, total, pageSize));
  }, [total, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) revealMore();
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, hasMore, revealMore]);

  return { visibleCount, hasMore, revealMore, sentinelRef };
}