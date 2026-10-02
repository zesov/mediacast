"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Episode } from '../app/types';
import { useEpisode } from '../app/contexts/EpisodeContext';
import { useTranslations } from 'next-intl';
import { usePlaybackTracking } from '@/hooks/usePlaybackTracking';

const defaultEpisode: Episode = {
  id: 1,
  title: '',
  description: '',
  enclosureUrl: 'https://podcast.rthk.hk/podcast/media/enca_hktoday/78_2508250850_71679.mp3',
  enclosureType: 'audio/mpeg',
  feedTitle: '',
  image: 'https://podcast.rthk.hk/podcast/upload_photo/item_photo/1400x1400_78.jpg',
  datePublishedPretty: '',
  datePublished: 1234567890,
  enclosureLength: 10,
  feedImage: 'https://podcast.rthk.hk/podcast/upload_photo/item_photo/1400x1400_78.jpg',
};

export default function Player({ title = true }: { title?: boolean }) {
const t = useTranslations('player');
  const { currentEpisode: contextEpisode, toPlay, setToPlay, isPlaying, setIsPlaying } = useEpisode();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasStartedRef = useRef(false);

  const currentEpisode = contextEpisode || defaultEpisode;
  if (!currentEpisode) return null;

  const { startTracking, stopTracking, heartbeat } = usePlaybackTracking({
    contentType: 'podcast',
    contentId: String(currentEpisode.id),
    contentTitle: currentEpisode.title,
    enabled: true,
  });

  // 初始化音频元素
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnd = async () => {
      setIsPlaying(false);
      await stopTracking(audio.currentTime);
      hasStartedRef.current = false;
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnd);

    // 设置音量
    audio.volume = volume;
    audio.muted = isMuted;

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnd);
    };
  }, [volume, isMuted, stopTracking]);

  // 播放/暂停切换
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // 首次播放才记录，不 await：网络请求会消耗用户手势窗口导致 play() 被拦截，
      // 播放状态由原生 play/pause 事件同步（见上方事件监听）
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        startTracking({ title: currentEpisode.title });
      }
      audio.play().catch(error => {
        console.error(t("playbackFailed"), error);
      });
    }
  };

  // 心跳定时器
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 监听播放状态变化以管理心跳
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (heartbeatIntervalRef.current) return;
      heartbeatIntervalRef.current = setInterval(() => {
        if (!audio.paused && !audio.ended) {
          heartbeat(audio.currentTime);
        }
      }, 30000);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [heartbeat]);

  // 前进15秒
  const forward = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.min(audio.currentTime + 15, duration);
  };

  // 后退15秒
  const backward = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(audio.currentTime - 15, 0);
  };

  // 调整进度
  const handleSeek = (e: React.MouseEvent) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * duration;
  };

  // 调整音量
  const handleVolumeChange = (e: React.MouseEvent) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const newVolume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    setVolume(newVolume);
    audio.volume = newVolume;

    // 如果音量调整为0，则静音
    if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
    } else if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  // 切换静音
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 计算进度百分比
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;

  // 自动播放
  useEffect(() => {
    if (toPlay) {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrentTime(0);
      setDuration(audio.duration);
      audio.play().catch(error => {
        console.error(t("playbackFailed"), error);
      });
      setIsPlaying(true);
      setToPlay(false);
    }
  }, [toPlay, isPlaying]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        crossOrigin="anonymous"
      />
      {/* 隐藏的音频元素 */}
      <audio
        ref={audioRef}
        src={currentEpisode.enclosureUrl}
        preload="metadata"
        className="episode-player-audio"
      />

{/* 播放器界面 */}
       <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6 lg:sticky lg:top-20 mobile-fixed-bottom z-50">
        {title && (
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-lg flex items-center justify-center">
              <img className="text-indigo-500 text-xl" src={currentEpisode.image || currentEpisode.feedImage || '/music.svg'}></img>
            </div>
            <div className="ml-4">
              <h3 className="font-medium">{currentEpisode.title || t('notSelected')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{currentEpisode.feedTitle}</p>
            </div>
          </div>
        )}

        {/* 进度条 */}
        <div className="mb-4">
          <div
            className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full mb-1 cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-1 bg-indigo-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex justify-between items-center">
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={backward}
          >
            <i className="fas fa-step-backward"></i>
          </button>

          <button
            className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white rounded-full w-10 h-10 flex items-center justify-center"
            onClick={togglePlayPause}
          >
            <i className={isPlaying ? "fas fa-pause" : "fas fa-play"}></i>
          </button>

          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={forward}
          >
            <i className="fas fa-step-forward"></i>
          </button>

          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={toggleMute}
          >
            <i className={isMuted ? "fas fa-volume-mute" : "fas fa-volume-up"}></i>
          </button>

          <div className="w-20">
            <div
              className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full cursor-pointer"
              onClick={handleVolumeChange}
            >
              <div
                className="h-1 bg-indigo-500 rounded-full"
                style={{ width: `${volumePercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}