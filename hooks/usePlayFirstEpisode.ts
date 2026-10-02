'use client';

import { useCallback, useState } from 'react';
import { Episode } from '@/app/types';
import { useEpisodeActions } from '@/app/contexts/EpisodeContext';

/**
 * 播放某个 feed 的最新一集。三个播客区块此前各自复制了一份实现，且都缺少
 * 数组校验：接口返回错误对象时 episodes[0] 为 undefined，Player 会回退到
 * 硬编码的默认音频，于是用户以为点不动。
 */
export function usePlayFirstEpisode() {
  const { setCurrentEpisode, setToPlay } = useEpisodeActions();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playFirstEpisode = useCallback(
    async (feedId: string) => {
      setPendingId(feedId);
      setError(null);
      try {
        const res = await fetch(`/api/episodesByFeedId?id=${encodeURIComponent(feedId)}`);
        if (!res.ok) {
          setError('Failed to load episodes');
          return;
        }

        const episodes: unknown = await res.json();
        if (!Array.isArray(episodes) || episodes.length === 0) {
          setError('No episodes available');
          return;
        }

        const first = episodes[0] as Episode;
        if (!first?.enclosureUrl) {
          setError('Episode is not playable');
          return;
        }

        setCurrentEpisode(first);
        setToPlay(true);
      } catch {
        setError('Failed to load episodes');
      } finally {
        setPendingId(null);
      }
    },
    [setCurrentEpisode, setToPlay],
  );

  return { playFirstEpisode, pendingId, error };
}