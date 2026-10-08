# Spec: PWA App Shell 离线支持 (Next-Radio)

> 状态: DRAFT — 待审阅。范围 **B. App Shell 离线**（断网可打开界面、浏览频道，播放需网络）。方案 **1: 手写 manifest + SW**（零新依赖）。

## 背景 / Why

next-podcast 是一个 Next.js 16.1.6 (App Router) + next-intl (zh/en) 的播客 + 直播播放器。
用户希望把站点升级为可安装 PWA，离线时可打开应用界面（App Shell），播放仍需网络。

选择方案 1（手写 `app/manifest.ts` + `public/sw.js`）的原因：

- **build 用 Turbopack**（`next build --turbopack`）——webpack 时代的 next-pwa/workbox 插件集成有兼容风险
- 项目 AGENTS.md 明确倾向最小依赖、手搓实现（Tailwind 工具类手写、无测试基建）
- `public/` 已有 MSW 的 `mockServiceWorker.js`；SW 作用域独立（`/sw.js`），互不干扰
- B 范围不需要 Workbox 的完整 precache + ExpirationPlugin 复杂度

## 关键约束 / Constraints

1. **无构建期 precache 注入**：Turbopack build 的 chunk 文件名带 hash，手写 SW 无法在 install 时知道精确文件名 → 全部用**运行时缓存**策略（network-first / cache-first），不生成 precache manifest。
2. **locale 前缀路由**：`/zh/*`、`/en/*`；`start_url` 必须指向具体 locale 路由（`/zh`）。
3. **dev 不注册 SW**：`process.env.NODE_ENV === 'production'` 才注册，避免 SW 缓存旧 chunk 干扰 Turbopack HMR。
4. **API 数据不缓存**：`/api/*` 一律 network-only（Deno KV 数据不稳 + 数据应有实时性）。
5. **图标零新依赖**：复用 devDeps 已有的 Playwright 渲染 SVG → PNG 生成图标。

## 交付物 / Files

| 文件 | 类型 | 作用 |
|---|---|---|
| `app/manifest.ts` | 新增 | Next.js `MetadataRoute.Manifest` 动态生成 `/manifest.webmanifest` |
| `public/sw.js` | 新增 | 手写 Service Worker（App Shell 缓存策略） |
| `components/PwaRegister.tsx` | 新增 | `'use client'`，load 后注册 SW（仅 production） |
| `app/[locale]/layout.tsx` | 修改 | 在 `<html>` 加 `viewport`/`themeColor`/`appleWebApp` metadata |
| `scripts/generate-icons.mjs` | 新增 | 用 Playwright 渲染 `design/icon.svg` → `public/icons/icon-192.png`、`icon-512.png`、`maskable-512.png` |
| `public/icons/*.png` | 生成 | manifest icons + apple-touch-icon |

## 详细设计 / Design

### 1. manifest (`app/manifest.ts`)

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mediacast",
    short_name: "播客",
    description: "HK / RTHK 播客与直播播放器",
    start_url: "/zh",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4f46e5",   // indigo-600，与按钮品牌色一致
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

> start_url 假设为 `/zh`（defaultLocale，中文首页）。若用户希望直播页当入口，改 `/zh/live` 即可（`/live` 在 `[locale]` 下）。

### 2. Service Worker (`public/sw.js`)

纯 vanilla JS（非 module，顶层 `self`），版本化缓存名 `app-shell-v1`。

**install**: `skipWaiting()`（让新 SW 立即接管，避免旧版多次刷新才能更新）。

**activate**: `clients.claim()` + 清理非 `app-shell-v1` 的旧缓存。

**fetch** 三类策略：

| 请求 | 策略 | 说明 |
|---|---|---|
| `request.mode === 'navigate'` | **network-first**，失败 fallback 到缓存的最近一次 HTML | **App Shell 核心**：断网可打开界面 |
| 同源 `/_next/static/*` | **cache-first** + 后台 revalidate（stale-while-revalidate） | JS/CSS chunk 离线可用 |
| 图片（远程 artwork/logo） | **cache-first**，LRU 上限 ~200 张 | 播客封面离线显示 |
| `/api/*` | **network-only** | 绝不缓存动态数据 |

**navigation network-first 细节**：
1. `fetch(request)` 成功 → `cache.put(request, response)` 存一份 → 返回
2. 失败（断网）→ 从缓存取最近响应，命中则返回，未命中则 `caches.match('/zh')` 兜底 + 可考虑返回 503 的合成响应

**static cache-first + revalidate 细节**：
1. 命中缓存 → 返回；同时后台 `fetch` 更新缓存（hash 文件名保证内容不变，纯 freshness）
2. 未命中 → fetch 并 `cache.put`

**图片 LRU**：
- 缓存名单独一个 store（如 `images-v1`），`put` 时维护 FIFO 队列键（`cache.put` 新 key 优先）
- 超过 200 条时删除最旧 key（用 `cache.keys()` 前 N 删）

> 跨域图片需要 `no-cors` fetch 以缓存 opaque response；cache-first 命中率最大化。播放/直播流请求（`.m3u8`、`.ts`、`.mp4`、YouTube iframe）**一律不拦截**（仅 `mode: 'navigate'`、`/_next/static`、图片 image 类型走缓存，其他放行）。

### 3. 注册组件 (`components/PwaRegister.tsx`)

```tsx
"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 静默失败：不支持或受限环境 */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
```

- 放在 `app/[locale]/layout.tsx` 的 `<body>` 内（`<MockBootstrap>` 旁），两种 locale 都会注入
- 挂 `window.load`：不阻塞首屏 LCP

### 4. layout metadata（`app/[locale]/layout.tsx`）

```tsx
export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export const metadata: Metadata = {
  applicationName: "Mediacast",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "播客",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};
```

> `app/manifest.ts` 会自动注入 `<link rel="manifest">`，无需手动。`themeColor` 用 viewport export（Next 15+ 推荐替代 metadata.themeColor）。

### 5. 图标生成 (`scripts/generate-icons.mjs`)

- `design/icon.svg`：手写 SVG——indigo-600 (`#4f46e5`) 圆角方块 + 白色播放三角
- Playwright 脚本：`page.setContent(svg)` → 按 192/512 尺寸 `page.screenshot({ transparent: true })` 输出 PNG；maskable 版本四周留安全边距（SVG padding 20%）
- 运行一次提交产物，无需构建钩子

## 验收标准 / Acceptance Criteria

1. `npm run build` 通过（Turbopack）
2. `/manifest.webmanifest` 返回 200，`name`/`icons`/`theme_color`/`start_url: "/zh"` 齐全
3. Playwright A：production 构建下 `navigator.serviceWorker.ready` 解析；`/sw.js` 注册成功
4. **Playwright B（核心验收）**：正常加载首页 → 等 SW ready + 缓存填充 → `context.setOffline(true)` → 刷新 `/zh` 仍渲染出导航与应用外壳（无网络报错页）
5. 在线时 `/api/*` 请求仍是实时数据（network-only 生效，Playwright 观察 network 请求没走 SW cache）
6. 图标文件存在：`public/icons/icon-192.png`（192×192）、`icon-512.png`（512×512）、`maskable-512.png`（512×512）
7. dev 模式（`npm run dev`）下 `navigator.serviceWorker` 未注册（页面无 SW）

## 风险 / Risks

| 风险 | 缓解 |
|---|---|
| navigation 缓存了旧 HTML（含旧 chunk 引用）导致线上静态混用 | network-first：在线永远用新 HTML；chunk 缓存 hash 隔离，旧条目 LRU 淘汰 |
| opaque 图片缓存会占用存储 | LRU 上限 200 条，浏览器自动驱逐超限 |
| iOS Safari 忽略 `theme_color`/maskable | iOS 用 `apple-touch-icon` + `appleWebApp` 兼容；standalone 支持正常 |
| SW 更新时机（旧 tab 仍持旧版） | `skipWaiting` + `clients.claim` 尽力即时更新 |

## 非目标 / Non-Goals

- 不缓存音频/HLS 流（范围 B 明确播放需网络）
- 不做构建期 precache manifest 注入
- 不引入 next-pwa / workbox / 任何新依赖
- 不做 `beforeinstallprompt` 自定义安装按钮（浏览器原生安装 UI 即可，后续可加）