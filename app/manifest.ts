import type { MetadataRoute } from "next";

// PWA manifest：由 Next.js 自动生成 /manifest.webmanifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MediaC",
    short_name: "MediaC",
    description: "Podcast & Live TV Player",
    start_url: "/en",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4f46e5", // indigo-600，与按钮品牌色一致
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    id: "com.jchk.mediacast",
  };
}