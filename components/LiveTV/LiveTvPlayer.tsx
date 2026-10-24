'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type Hls from 'hls.js';
import { usePlaybackTracking } from '@/hooks/usePlaybackTracking';

// 直播播放器（HLS 视频/音频）
// Safari 原生支持 HLS；其他浏览器使用 hls.js（动态导入避免 SSR window 报错）。
// 部分频道地址为 bally:// 等自定义协议或短链，浏览器无法直接播放，需解析后才能播。
// 接受最小化的频道类型，兼容 LiveChannel、FreeTVChannel、M3UChannel
interface PlayableChannel {
  id: string;
  name: string;
  logo?: string;
  streamUrl: string;
  type?: 'video' | 'audio';
  number?: number;
}

interface LiveTvPlayerProps {
  channel: PlayableChannel | null;
  className?: string;
  overlay?: React.ReactNode; // 叠加在视频上的元数据（Plex hero 风格：频道 logo + 当前节目）
}

// 是否为可由 <video>/hls.js 直接播放的 http(s) 地址
function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// 同源代理仅作兜底：直连失败（典型：流服务器不带 CORS 头，hls.js 请求被浏览器拦截）时
// 经 /api/free-tv/proxy 转发；本地（localhost）地址无需代理，直接播放。
function proxyUrlFor(url: string): string {
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$|\/)/i.test(url)) {
    return url;
  }
  return `/api/free-tv/proxy?url=${encodeURIComponent(url)}`;
}

export default function LiveTvPlayer({ channel, className = '', overlay }: LiveTvPlayerProps) {
  const t = useTranslations('live');
  const mediaRef = useRef<HTMLMediaElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  // 直连失败后是否已兜底切到代理（每次切换频道重置）
  const fallbackUsedRef = useRef(false);
  // 字幕轨道：源含 WebVTT/CC 轨道才显示字幕按钮（源有就顯示，無就唔顯示）
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [subtitleOn, setSubtitleOn] = useState(false);
  const subtitleUserToggledRef = useRef(false);

  const playableUrl =
    channel && isHttpUrl(channel.streamUrl) ? proxyUrlFor(channel.streamUrl) : null;

  const { startTracking, stopTracking, heartbeat } = usePlaybackTracking({
    contentType: 'live',
    contentId: channel?.id || '',
    contentTitle: channel?.name,
    enabled: !!channel && !!playableUrl,
  });

  // 切换频道時重建播放器
  useEffect(() => {
    if (!channel || !mediaRef.current) return;

    // 非 http(s) 地址無法直接播放，提示
    if (!isHttpUrl(channel.streamUrl)) {
      setIsSupported(false);
      setErrorMessage(`${t('nonHttpStream')} (${channel.streamUrl.slice(0, 30)}…)`);
      return () => {};
    }

    const media = mediaRef.current;
    let hls: Hls | null = null;
    let destroyed = false;

    // 直连优先；fatal 网络错误（典型：无 CORS 头被浏览器拦截）时兜底走同源代理，仅重试一次
    const directUrl = channel.streamUrl;
    const proxyUrl = proxyUrlFor(channel.streamUrl);
    fallbackUsedRef.current = false;

    const clearError = () => setErrorMessage(null);
    clearError();
    setIsSupported(true);

    // Safari 原生 HLS 播放失败（非本地地址且有代理可用）→ 切代理重试一次
    const onNativeError = () => {
      if (destroyed || fallbackUsedRef.current || proxyUrl === directUrl) return;
      fallbackUsedRef.current = true;
      clearError();
      media.src = proxyUrl;
      media.load();
      media.play().catch(() => setIsPlaying(false));
    };

    // 1) Safari 原生 HLS
    // 注意：不能用 canPlayType 判断 — Chrome headless 返回 'maybe'（truthy）但不真正支持 HLS，
    // 会导致走原生分支而播放失败。改用 MediaSource 检测：Safari 无 MediaSource，走原生；其余走 hls.js。
    const hasMediaSource = typeof MediaSource !== 'undefined';
    // Safari 原生 HLS：字幕轨道从 video.textTracks 暴露（定义在分支外，cleanup 需移除监听）
    const checkNativeTracks = () => {
      const tracks = Array.from(media.textTracks).filter(
        (tr) => tr.kind === 'subtitles' || tr.kind === 'captions'
      );
      setHasSubtitles(tracks.length > 0);
      if (tracks.length > 0 && !subtitleUserToggledRef.current) {
        tracks.forEach((tr) => {
          tr.mode = 'showing';
        });
        setSubtitleOn(true);
      }
    };
    if (!hasMediaSource) {
      media.src = directUrl;
      media.play().catch(() => setIsPlaying(false));
      media.addEventListener('error', onNativeError);
      checkNativeTracks();
      media.textTracks.addEventListener('addtrack', checkNativeTracks);
      media.textTracks.addEventListener('removetrack', checkNativeTracks);
    } else {
      // 2) 其他瀏覽器：hls.js（動態導入，僅客戶端）
      import('hls.js').then(({ default: HlsModule }) => {
        if (destroyed || !mediaRef.current) return;
        if (HlsModule.isSupported()) {
          const createHls = (url: string) => {
            hls = new HlsModule({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(media);
            hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
              mediaRef.current?.play().catch(() => setIsPlaying(false));
            });

            // 字幕轨道检测（WebVTT）：有轨默认自动显示字幕
            hls.on(HlsModule.Events.SUBTITLE_TRACKS_UPDATED, () => {
              if (destroyed || !hls) return;
              const tracks = hls.subtitleTracks || [];
              setHasSubtitles(tracks.length > 0);
              if (tracks.length > 0 && !subtitleUserToggledRef.current) {
                hls.subtitleTrack = 0;
                setSubtitleOn(true);
              }
            });

            // HLS 錯誤處理
            hls.on(HlsModule.Events.ERROR, (event, data) => {
              if (destroyed) return;
              if (data.fatal) {
                // 直连 fatal 网络错误 → 兜底走代理重试一次（典型：流服务器无 CORS 头被浏览器拦截）
                if (
                  !fallbackUsedRef.current &&
                  proxyUrl !== directUrl &&
                  data.type === HlsModule.ErrorTypes.NETWORK_ERROR
                ) {
                  fallbackUsedRef.current = true;
                  hls?.destroy();
                  hlsRef.current = null;
                  clearError();
                  createHls(proxyUrl);
                  return;
                }
                switch (data.type) {
                  case HlsModule.ErrorTypes.NETWORK_ERROR:
                    setErrorMessage(t('networkError'));
                    break;
                  case HlsModule.ErrorTypes.MEDIA_ERROR:
                    setErrorMessage(t('mediaError'));
                    break;
                  case HlsModule.ErrorTypes.MUX_ERROR:
                    setErrorMessage(t('muxError'));
                    break;
                  default:
                    setErrorMessage(t('hlsError'));
                }
                setIsPlaying(false);
              } else if (data.type === HlsModule.ErrorTypes.MEDIA_ERROR && hls) {
                // 非致命媒體錯誤：嘗試恢復
                hls.recoverMediaError();
              }
            });
          };
          createHls(directUrl);
        } else {
          setIsSupported(false);
          setErrorMessage(t('unsupported'));
        }
      });
    }

    setIsPlaying(false);
    hasStartedRef.current = false;

    return () => {
      destroyed = true;
      media.removeEventListener('error', onNativeError);
      media.textTracks.removeEventListener('addtrack', checkNativeTracks);
      media.textTracks.removeEventListener('removetrack', checkNativeTracks);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  // 媒體元素錯誤處理（原生 HLS / hls.js attach 後均會觸發）
  const handleMediaError = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    const err = media.error;
    if (!err) return;
    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        setErrorMessage(t('aborted'));
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        setErrorMessage(t('networkError'));
        break;
      case MediaError.MEDIA_ERR_DECODE:
        setErrorMessage(t('decodeError'));
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        setErrorMessage(t('unsupported'));
        setIsSupported(false);
        break;
      default:
        setErrorMessage(t('playbackError'));
    }
    setIsPlaying(false);
  }, [t]);

  // 播放 / 暫停
  const togglePlay = async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        await startTracking({ title: channel?.name });
      }
      media.play().catch(() => setIsPlaying(false));
    } else {
      media.pause();
    }
  };

  // 心跳定时器
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 监听播放状态变化以管理心跳
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handlePlay = () => {
      if (heartbeatIntervalRef.current) return;
      heartbeatIntervalRef.current = setInterval(() => {
        if (!media.paused && !media.ended) {
          heartbeat(media.currentTime);
        }
      }, 30000);
    };

    const handlePause = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const handleEnded = async () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      await stopTracking(media.currentTime);
      hasStartedRef.current = false;
    };

    media.addEventListener('play', handlePlay);
    media.addEventListener('pause', handlePause);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('play', handlePlay);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('ended', handleEnded);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [heartbeat, stopTracking, channel?.id]);

  // 静音
  const toggleMute = () => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setIsMuted(media.muted);
  };

  // 字幕开关（hls.js 用 subtitleTrack；Safari 原生切 textTracks mode）
  const toggleSubtitles = () => {
    const media = mediaRef.current;
    const hls = hlsRef.current;
    subtitleUserToggledRef.current = true;
    const next = !subtitleOn;
    if (hls) {
      hls.subtitleTrack = next ? 0 : -1;
    } else if (media) {
      const tracks = Array.from(media.textTracks).filter(
        (tr) => tr.kind === 'subtitles' || tr.kind === 'captions'
      );
      tracks.forEach((tr) => {
        tr.mode = next ? 'showing' : 'disabled';
      });
    }
    setSubtitleOn(next);
  };

  // 全屏
  const toggleFullscreen = () => {
    const media = mediaRef.current;
    const container = media?.closest('.live-player-container') as HTMLElement | null;
    if (!media) return;

    const anyMedia = media as any;
    // iOS Safari：仅 <video> 支持全屏（webkitEnterFullscreen），容器 requestFullscreen 不可用
    if (typeof anyMedia.webkitEnterFullscreen === 'function') {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (typeof anyMedia.webkitExitFullscreen === 'function') {
          anyMedia.webkitExitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else {
          document.exitFullscreen();
        }
      } else {
        anyMedia.webkitEnterFullscreen();
      }
      return;
    }

    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => {});
    }
  };

  // 键盘快捷键：F 全屏，C 字幕，P 暂/播，M 静音
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在表单控件内输入时触发的快捷键（如 input, textarea, 等）
      if (['input', 'textarea', 'select', 'button', 'a'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }
      if (e.key.toLowerCase() === 'f' && playableUrl) {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key.toLowerCase() === 'c' && hasSubtitles && playableUrl) {
        e.preventDefault();
        toggleSubtitles();
      }
      if (e.key.toLowerCase() === 'p' && playableUrl) {
        e.preventDefault();
        togglePlay();
      }
      if (e.key.toLowerCase() === 'm' && playableUrl) {
        e.preventDefault();
        toggleMute();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, toggleSubtitles, togglePlay, toggleMute, playableUrl, hasSubtitles]);

  if (!channel) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg">{t("selectChannel")}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("selectHint")}</p>
      </div>
    );
  }

  return (
    <div className={`live-player-container bg-white dark:bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{t("live")}</span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
          {channel.name}
          {channel.number != null && <span className="ml-2 text-gray-500 dark:text-gray-400">CH {channel.number}</span>}
        </span>
      </div>

      {channel.type !== 'audio' ? (
        <div className="relative" onClick={togglePlay}>
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            className="w-full aspect-video bg-black"
            controls={false}
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={handleMediaError}
          />
          {overlay && <div className="absolute inset-0 pointer-events-none">{overlay}</div>}
        </div>
      ) : (
        <div className="w-full aspect-video bg-black flex items-center justify-center" onClick={togglePlay}>
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            className="w-2/3"
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={handleMediaError}
          />
        </div>
      )}

      {(!isSupported || errorMessage) && channel && (
        <p className="px-4 py-2 text-sm text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-gray-800">
          {!playableUrl
            ? `${t('nonHttpStream')} (${channel.streamUrl.slice(0, 30)}…)`
            : errorMessage || t('unsupported')}
        </p>
      )}

      <div className="flex items-center justify-center space-x-4 px-4 py-3 bg-gray-100 dark:bg-gray-800">
        <button
          onClick={togglePlay}
          disabled={!playableUrl}
          className="w-12 h-12 rounded-full bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={isPlaying ? t("pause") : t("play")}
        >
          {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleMute}
          disabled={!playableUrl}
          className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={isMuted ? t("unmute") : t("mute")}
        >
          {isMuted ? <MuteIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
        </button>
        {hasSubtitles && (
          <button
            onClick={toggleSubtitles}
            disabled={!playableUrl}
            className={`w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
              subtitleOn
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white'
            }`}
            aria-label={subtitleOn ? t('subtitlesOff') : t('subtitlesOn')}
            title={subtitleOn ? t('subtitlesOff') : t('subtitlesOn')}
          >
            <CaptionsIcon className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          disabled={!playableUrl}
          className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t("fullscreen")}
        >
          <FullscreenIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// 内联 SVG 图标（不依赖外部 FontAwesome CDN，避免加载失败导致按钮只有颜色无图标）
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.9 8.9 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function CaptionsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM8.9 15.5c-1.6 0-2.9-1.3-2.9-3.5s1.3-3.5 2.9-3.5c1.1 0 2 .5 2.6 1.4l-1.5 1c-.3-.5-.6-.7-1-.7-.8 0-1.2.7-1.2 1.8s.4 1.8 1.2 1.8c.5 0 .8-.2 1.1-.7l1.5 1c-.6 1-1.5 1.4-2.7 1.4zm7.5 0c-1.6 0-2.9-1.3-2.9-3.5s1.3-3.5 2.9-3.5c1.1 0 2 .5 2.6 1.4l-1.5 1c-.3-.5-.6-.7-1-.7-.8 0-1.2.7-1.2 1.8s.4 1.8 1.2 1.8c.5 0 .8-.2 1.1-.7l1.5 1c-.6 1-1.5 1.4-2.7 1.4z" />
    </svg>
  );
}
