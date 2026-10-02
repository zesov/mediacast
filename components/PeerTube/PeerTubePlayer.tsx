"use client";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { PeerTubeVideo } from "@/app/types";
import { usePlaybackTracking } from "@/hooks/usePlaybackTracking";

interface PlayerElementProps {
  controls?: boolean;
  src?: string;
  poster?: string;
  className?: string;
}

// 仅在客户端挂载后才加载 peertube-video-element，避免 SSR/水合期间
// 触发 "Channel.build() called without a valid window argument" 错误
// 见 node_modules/peertube-video-element/dist/peertube-video-element.js:165
function PeerTubeVideoElementWrapper({
  controls,
  src,
  poster,
  className,
}: PlayerElementProps) {
  const [mounted, setMounted] = useState(false);
  const [Component, setComponent] = useState<ComponentType<PlayerElementProps> | null>(null);

  useEffect(() => {
    setMounted(true);
    import("peertube-video-element/react").then((mod) => {
      setComponent(() => mod.default as ComponentType<PlayerElementProps>);
    });
  }, []);

  if (!mounted) {
    return (
      <div className="aspect-video rounded-xl bg-gray-900 flex items-center justify-center text-white">
        正在加载 PeerTube 播放器…
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="aspect-video rounded-xl bg-gray-900 flex items-center justify-center text-white">
        正在加载 PeerTube 播放器…
      </div>
    );
  }

  return <Component controls={controls} src={src} poster={poster} className={className} />;
}

interface Props {
  video: PeerTubeVideo;
}

export default function PeerTubePlayer({ video }: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const observersRef = useRef<MutationObserver[]>([]);

  const { startTracking, stopTracking, heartbeat } = usePlaybackTracking({
    contentType: "peertube",
    contentId: video.uuid,
    contentTitle: video.name,
    enabled: true,
  });

  // 监听 peertube-video 自定义元素的渲染
  useEffect(() => {
    const container = videoRef.current;
    if (!container) return;

    let cleanupDone = false;

    const attachToCustomElement = (peertubeEl: HTMLElement) => {
      // Test if events fire on the custom element itself
      const handlePlay = async () => {
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          await startTracking({ title: video.name });
        }
        // Start heartbeat - peertube-video extends HTMLVideoElement
        heartbeatInterval.current = setInterval(() => {
          // @ts-ignore - peertube-video has HTMLVideoElement properties
          if (!peertubeEl.paused && !peertubeEl.ended) {
            // @ts-ignore
            heartbeat(peertubeEl.currentTime);
          }
        }, 30000);
      };

      const handlePause = () => {
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      };

      const handleEnded = async () => {
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
        // @ts-ignore - peertube-video has HTMLVideoElement properties
        await stopTracking(peertubeEl.currentTime || 0);
        hasStartedRef.current = false;
      };

      peertubeEl.addEventListener("play", handlePlay);
      peertubeEl.addEventListener("pause", handlePause);
      peertubeEl.addEventListener("ended", handleEnded);

      // Store cleanup function
      return () => {
        peertubeEl.removeEventListener("play", handlePlay);
        peertubeEl.removeEventListener("pause", handlePause);
        peertubeEl.removeEventListener("ended", handleEnded);
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
      };
    };

    // Check if already rendered
    const existingPeertubeEl = container.querySelector("peertube-video") as HTMLElement | null;
    let cleanup: (() => void) | null = null;

    if (existingPeertubeEl) {
      cleanup = attachToCustomElement(existingPeertubeEl);
    } else {
      // Wait for the custom element to be rendered
      const observer = new MutationObserver(() => {
        if (cleanupDone) return;
        const peertubeEl = container.querySelector("peertube-video") as HTMLElement | null;
        if (peertubeEl) {
          observer.disconnect();
          cleanup = attachToCustomElement(peertubeEl);
        }
      });
      
      observer.observe(container, { childList: true, subtree: true });
      observersRef.current.push(observer);
    }

    return () => {
      cleanupDone = true;
      cleanup?.();
      observersRef.current.forEach(o => o.disconnect());
      observersRef.current = [];
    };
  }, [video.uuid, startTracking, stopTracking, heartbeat]);

  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  return (
    <div ref={videoRef} className="rounded-xl overflow-hidden bg-black shadow-lg">
      <PeerTubeVideoElementWrapper
        controls
        src={video.embedUrl}
        poster={video.previewUrl || video.thumbnailUrl}
        className="w-full aspect-video"
      />
    </div>
  );
}
