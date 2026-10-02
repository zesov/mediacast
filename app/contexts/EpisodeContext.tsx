'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Episode } from '../types';

interface EpisodeContextType {
  episodes: Episode[];
  setEpisodes: (episodes: Episode[]) => void;
  currentEpisode: Episode | null;
  setCurrentEpisode: (episode: Episode | null) => void;
  toPlay: boolean;
  setToPlay: (toPlay: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
}

const EpisodeContext = createContext<EpisodeContextType | undefined>(undefined);

export function EpisodeProvider({ children }: { children: ReactNode }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [toPlay, setToPlay] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  return (
    <EpisodeContext.Provider value={{ 
      episodes, 
      setEpisodes, 
      currentEpisode, 
      setCurrentEpisode,
      toPlay,
      setToPlay,
      isPlaying,
      setIsPlaying,
    }}>
      {children}
    </EpisodeContext.Provider>
  );
}

export function useEpisode() {
  const context = useContext(EpisodeContext);
  if (context === undefined) {
    throw new Error('useEpisode must be used within an EpisodeProvider');
  }
  return context;
}
