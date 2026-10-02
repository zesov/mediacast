'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { Episode } from '../types';

interface EpisodeState {
  episodes: Episode[];
  currentEpisode: Episode | null;
  toPlay: boolean;
  isPlaying: boolean;
}

interface EpisodeActions {
  setEpisodes: (episodes: Episode[]) => void;
  setCurrentEpisode: (episode: Episode | null) => void;
  setToPlay: (toPlay: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

// 状态与 action 分成两个 context：只写不读的组件（如 usePlayFirstEpisode）
// 订阅 actions 后，播放进度变化不会再让它们重渲染。
const EpisodeStateContext = createContext<EpisodeState | undefined>(undefined);
const EpisodeActionsContext = createContext<EpisodeActions | undefined>(undefined);

export function EpisodeProvider({ children }: { children: ReactNode }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [toPlay, setToPlay] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const state = useMemo<EpisodeState>(
    () => ({ episodes, currentEpisode, toPlay, isPlaying }),
    [episodes, currentEpisode, toPlay, isPlaying],
  );

  // setState 函数身份稳定，因此这个对象只需创建一次。
  const actions = useMemo<EpisodeActions>(
    () => ({ setEpisodes, setCurrentEpisode, setToPlay, setIsPlaying }),
    [],
  );

  return (
    <EpisodeActionsContext.Provider value={actions}>
      <EpisodeStateContext.Provider value={state}>{children}</EpisodeStateContext.Provider>
    </EpisodeActionsContext.Provider>
  );
}

function useEpisodeState(): EpisodeState {
  const state = useContext(EpisodeStateContext);
  if (state === undefined) {
    throw new Error('useEpisode must be used within an EpisodeProvider');
  }
  return state;
}

function useEpisodeActions(): EpisodeActions {
  const actions = useContext(EpisodeActionsContext);
  if (actions === undefined) {
    throw new Error('useEpisode must be used within an EpisodeProvider');
  }
  return actions;
}

export { useEpisodeActions };

/** 需要读取播放状态时使用；只需要写入时优先用 useEpisodeActions 以避免多余重渲染。 */
export function useEpisode(): EpisodeState & EpisodeActions {
  return { ...useEpisodeState(), ...useEpisodeActions() };
}