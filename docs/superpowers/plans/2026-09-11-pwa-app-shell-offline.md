# PWA App Shell 离线支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 next-podcast 升级为可安装 PWA：断网时可打开应用外壳（App Shell）、浏览界面，播放与 API 数据需网络。

**Architecture:** 方案 1（手写、零新依赖）。`app/manifest.ts`（Next.js 原生 `MetadataRoute.Manifest`）生成 `/manifest.webmanifest`；`public/sw.js` 手写 Service Worker 用运行时缓存（network-first navigation / cache-first static+图片 / network-only API）；`components/PwaRegister.tsx` 仅 production 注册 SW；`layout.tsx` 注入 viewport+metadata；Playwright 生成图标 + 离线验收。

**Tech Stack:** Next.js 16.1.6 (App Router, Turbopack build) + next-intl (zh/en) + Tailwind v4 + Playwright (devDep, 浏览器已下载)。

**Spec:** `docs/superpowers/specs/pwa-app-shell-offline.md`

---

## 关键约束（实施前必读）

1. **build 是 Turbopack**：`npm run build`（脚本含 `--turbopack`）。无 webpack 插件可用 → SW 不做构建期 precache 注入，全运行时缓存。
2. **dev 不注册 SW**：`process.env.NODE_ENV !== "production"` 直接 return，避免 SW 缓存旧 chunk 干扰 Turbopack HMR。
3. **MSW 冲突排查已做**：`mocks/init-client.ts` 仅在 `NEXT_PUBLIC_MSW_ENABLE=true` 时注册 mockServiceWorker，生产构建不注册 → `/sw.js` 无冲突。
4. **locale 前缀**：路由是 `/zh/*`、`/en/*`，`start_url` 指向 `/zh`。
5. **AGENTS.md**：不要自动 git commit，要由用户明确提出先 commit。以下 commit 步骤均**先询问用户再执行**。
6. **无测试基建**：验证用 `npm run build` + Playwright 脚本（`uvx --from playwright python` 或 node playwright 均可用；本计划用 node playwright，浏览器已下载）。
7. 现有 dev server 或占用 3000 端口 → **验收用 3100 端口**（`npm run start -- -p 3100`）。

## 文件结构

| 文件 | 责任 |
|---|---|
| `design/icon.svg` (新增) | 图标设计源（indigo-600 圆角方块 + 白色播放三角） |
| `scripts/generate-icons.mjs` (新增) | 用 Playwright 渲染 SVG → PNG（192/512/maskable） |
| `public/icons/icon-192.png` (生成) | manifest icon 192 |
| `public/icons/icon-512.png` (生成) | manifest icon 512 |
| `public/icons/maskable-512.png` (生成) | maskable icon 512（内容在安全区内） |
| `app/manifest.ts` (新增) | `MetadataRoute.Manifest` → `/manifest.webmanifest` |
| `public/sw.js` (新增) | 手写 Service Worker（App Shell 缓存策略） |
| `components/PwaRegister.tsx` (新增) | `'use client'`，仅 production 注册 `/sw.js` |
| `app/[locale]/layout.tsx` (修改) | 加 `viewport`/`metadata` + 挂载 `<PwaRegister/>` |
| `scripts/pwa-verify.mjs` (新增) | 离线验收脚本（build+start 后运行） |

---

### Task 1: 生成 PWA 图标

**Files:**
- Create: `design/icon.svg`
- Create: `scripts/generate-icons.mjs`
- Generate: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`

- [ ] **Step 1: 写图标源 `design/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="88" fill="#4f46e5"/>
  <circle cx="256" cy="256" r="140" fill="#ffffff"/>
  <polygon points="220,180 220,332 350,256" fill="#4f46e5"/>
</svg>
```

> 设计：indigo-600 (`#4f46e5`) 圆角方块 + 白色圆 + 品牌色播放三角。SVG 源固定 512 规格。

- [ ] **Step 2: 写生成脚本 `scripts/generate-icons.mjs`**

```js
// 用 Playwright 渲染 SVG → PNG（复用已有 devDep，零新依赖）
// 输出：public/icons/icon-192.png / icon-512.png / maskable-512.png
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";

const OUT_DIR = "public/icons";
const svg = await readFile("design/icon.svg", "utf8");

async function renderSvg(size, outPath, markup = svg) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // 替换宽高到目标尺寸，浏览器按元素 bounding box 截图
  const scaled = markup
    .replace(/width="512"/, `width="${size}"`)
    .replace(/height="512"/, `height="${size}"`)
    .replace('<svg ', '<svg style="display:block" '); // 防 inline baseline 空隙
  await page.setContent(`<body style="margin:0;background:transparent">${scaled}</body>`);
  await page.locator("svg").screenshot({ path: outPath, omitBackground: true });
  await browser.close();
  console.log(`generated ${outPath} (${size}x${size})`);
}

// maskable 版：背景铺满（无圆角），内容不超出 80% 安全区
const maskable = svg
  .replace(
    '<rect width="512" height="512" rx="88" fill="#4f46e5"/>',
    '<rect width="512" height="512" fill="#4f46e5"/>',
  )
  // 缩放内容到安全区（中心 300px 见方 ≈ 58% < 80%）
  .replace('r="140"', 'r="120"')
  .replace('points="220,180 220,332 350,256"', 'points="228,190 228,322 336,256"');

await mkdir(OUT_DIR, { recursive: true });
await renderSvg(192, `${OUT_DIR}/icon-192.png`);
await renderSvg(512, `${OUT_DIR}/icon-512.png`);
await renderSvg(512, `${OUT_DIR}/maskable-512.png`, maskable);
```

- [ ] **Step 3: 运行脚本生成图标**

Run: `node scripts/generate-icons.mjs`
Expected: 三行 `generated public/icons/*.png`，无报错。

- [ ] **Step 4: 验证图标尺寸**

Run: `file public/icons/icon-192.png public/icons/icon-512.png public/icons/maskable-512.png`
Expected: `192x192`, `512x512`, `512x512` PNG image data。

- [ ] **Step 5: 询问用户后 commit**

```bash
git add design/icon.svg scripts/generate-icons.mjs public/icons/
git commit -m "feat(pwa): add PWA icons (192/512/maskable)"
```
（先问用户是否 commit）

---

### Task 2: 添加 manifest

**Files:**
- Create: `app/manifest.ts`

- [ ] **Step 1: 写 `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

// PWA manifest：由 Next.js 自动生成 /manifest.webmanifest
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
    theme_color: "#4f46e5", // indigo-600，与按钮品牌色一致
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 2: 类型检查（build 附带）**

Run: `npx tsc --noEmit`
Expected: 无输出（exit 0）。如报错修正类型。

- [ ] **Step 3: 询问用户后 commit**

```bash
git add app/manifest.ts
git commit -m "feat(pwa): add web app manifest"
```
（先问用户是否 commit）

---

### Task 3: 手写 Service Worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: 写 `public/sw.js`**

```js
/* PWA App Shell Service Worker（手写，零依赖）
 * 策略：
 * - navigation (HTML)      → network-first，断网 fallback 到最近缓存的 shell
 * - /_next/static/*        → cache-first + 后台 revalidate
 * - image (远程封面/logo)  → cache-first，LRU 上限 200 张
 * - /api/*                 → network-only（动态数据不缓存）
 * - 媒体流/iframe          → 不拦截（仅 respond 上面三类）
 */
const CACHE_NAME = "app-shell-v1";
const IMAGE_CACHE = "images-v1";
const IMAGE_MAX = 200;

self.addEventListener("install", () => {
  // 新 SW 立即接管，避免旧版需多次刷新才更新
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API 动态数据：绝不缓存
  if (url.pathname.startsWith("/api/")) return;

  // App Shell 核心：HTML 导航 network-first
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // 同源静态资源：cache-first + 后台 revalidate
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticCacheFirst(request));
    return;
  }

  // 图片：cache-first + LRU
  if (request.destination === "image") {
    event.respondWith(imageCacheFirst(request));
    return;
  }
  // 其余（媒体流、iframe、音频等）默认放行
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match("/zh")); // fallback：断网打开应用外壳
    if (cached) return cached;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function staticCacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // 后台刷新（hash 文件名保证内容不变，仅保新鲜）
    fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function imageCacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await trimImageCache(cache);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || new Response("", { status: 504 });
  }
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length >= IMAGE_MAX) {
    await Promise.all(
      keys.slice(0, keys.length - IMAGE_MAX + 1).map((key) => cache.delete(key)),
    );
  }
}
```

- [ ] **Step 2: 语法检查**

Run: `node --check public/sw.js`
Expected: 无输出（exit 0）。

- [ ] **Step 3: 询问用户后 commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): add app shell service worker"
```
（先问用户是否 commit）

---

### Task 4: SW 注册组件

**Files:**
- Create: `components/PwaRegister.tsx`

- [ ] **Step 1: 写 `components/PwaRegister.tsx`**

```tsx
"use client";

// PWA Service Worker 注册器
// 仅生产环境注册：dev 下 SW 会缓存旧 chunk 干扰 Turbopack HMR
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 静默失败：不支持或受限环境
      });
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（exit 0）。

- [ ] **Step 3: 询问用户后 commit**

```bash
git add components/PwaRegister.tsx
git commit -m "feat(pwa): register service worker in production"
```
（先问用户是否 commit）

---

### Task 5: layout 注入 metadata + 挂载注册器

**Files:**
- Modify: `app/[locale]/layout.tsx`（加 import、viewport/metadata export、body 内挂载）

- [ ] **Step 1: 在 `app/[locale]/layout.tsx` 顶部加 import**

把第 1 行（`import { NextIntlClientProvider } from "next-intl";`）前加：

```tsx
import type { Metadata, Viewport } from "next";
```

现有 import 保持不动。

- [ ] **Step 2: 在 `generateStaticParams` 后加 viewport/metadata export**

```tsx
export const viewport: Viewport = {
  themeColor: "#4f46e5", // indigo-600，与 manifest 一致
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

- [ ] **Step 3: 在 `<body>` 内挂载 `<PwaRegister />`**

在 `</body>` 前、`<NextIntlClientProvider>` 闭合后加：

```tsx
        <PwaRegister />
```

并在文件顶部 import 区加：

```tsx
import PwaRegister from "@/components/PwaRegister";
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（exit 0）。

- [ ] **Step 5: 询问用户后 commit**

```bash
git add app/[locale]/layout.tsx
git commit -m "feat(pwa): add pwa metadata and sw registration to layout"
```
（先问用户是否 commit）

---

### Task 6: 离线验收（Playwright）

**Files:**
- Create: `scripts/pwa-verify.mjs`

前置：执行受测构建。用 3100 端口避免与 dev server (3000) 冲突。

- [ ] **Step 1: 写验收脚本 `scripts/pwa-verify.mjs`**

```js
// PWA 离线验收脚本
// 用法：先 npm run build && npm run start -- -p 3100，再 node scripts/pwa-verify.mjs
// 验收点：
//  1. /manifest.webmanifest 200 且字段齐全
//  2. SW ready + controller 生效
//  3. 【核心】offline reload 后 App Shell 仍渲染（导航栏出现）
//  4. 无页面 JS 错误
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3100";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// 1. manifest 可访问且字段齐全
const manifestRes = await page.goto(`${BASE}/manifest.webmanifest`);
if (manifestRes.status() !== 200) throw new Error(`manifest status ${manifestRes.status()}`);
const manifest = await manifestRes.json();
const expect = { name: "Mediacast", start_url: "/zh", theme_color: "#4f46e5", display: "standalone" };
for (const [k, v] of Object.entries(expect)) {
  if (manifest[k] !== v) throw new Error(`manifest.${k}=${JSON.stringify(manifest[k])}, expect ${v}`);
}

// 2. 加载 /zh，等 SW ready + controller
await page.goto(`${BASE}/zh`, { waitUntil: "networkidle" });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
// 缓存填充：二次加载（HTML + static chunks 全部入缓存）
await page.reload({ waitUntil: "networkidle" });

// 3. 核心：模拟离线 → 刷新 → App Shell 仍渲染
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("nav", { timeout: 10000 });
const hasNav = (await page.locator("nav").count()) > 0;
// 恢复在线
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});

if (!hasNav) throw new Error("offline reload: nav not rendered (App Shell failed)");
if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);

await browser.close();
console.log("PWA VERIFY PASS");
```

- [ ] **Step 2: 备份 dev server 状态并生产构建**

> ⚠️ 3000 端口如有 dev server 在跑（`pm2`/nohup），`rm -rf .next` 会清掉它的 `.next` 缓存并使其失效。若需要恢复 dev，验收完成后用 `nohup npm run dev > /tmp/opencode/next-dev.log 2>&1 &` 重启。

Run: `rm -rf .next && npm run build`
Expected: exit 0，`Compiled successfully`（Turbopack 输出）。

- [ ] **Step 3: 启动生产 server (3100)**

Run: `nohup npm run start -- -p 3100 > /tmp/opencode/pwa-start.log 2>&1 &`
Expected: 日志出现 `Ready in ...`，`curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/zh` 返回 200。

- [ ] **Step 4: 运行验收脚本**

Run: `node scripts/pwa-verify.mjs`
Expected: `PWA VERIFY PASS`（exit 0）。

**若 Step 4 失败**，按顺序排查：
1. `nav not rendered`：确认 `waitForSelector("nav")` 选择器——页面导航栏是否真的是 `<nav>` 标签？不是则改用可见文本断言（如 `page.getByText("播客")`）并更新脚本。
2. `manifest.*` 断言失败：确认 `app/manifest.ts` 字段与断言一致。
3. pageerror：查看报错堆栈修正。

- [ ] **Step 5: 关闭生产 server**

Run: `pkill -f "next start -p 3100" || pkill -f "next-server"`（仅杀验收进程，不影响 3000 dev server）
Expected: 无输出（进程消失）。

- [ ] **Step 6: 询问用户后 commit**

```bash
git add scripts/pwa-verify.mjs
git commit -m "test(pwa): add offline acceptance script"
```
（先问用户是否 commit）

---

## 验收标准总览（对照 spec）

| Spec AC | 对应验证 |
|---|---|
| `npm run build` 通过 | Task 6 Step 2 |
| `/manifest.webmanifest` 200 + 字段齐全 | Task 6 Step 4 (manifest 断言) |
| SW ready + 注册成功 | Task 6 Step 4 (controller wait) |
| **离线刷新仍渲染外壳**（核心） | Task 6 Step 4 (offline reload + nav) |
| `/api/*` network-only | sw.js 代码保证 + Task 6 无 API 断言（在线时 API 正常工作） |
| 图标 192/512 存在 | Task 1 Step 4 (`file` 检查) |
| dev 不注册 SW | PwaRegister `NODE_ENV` 门 + 代码 review |

## 风险与缓解（实施时注意）

- **导航栏选择器**：若页面 `<nav>` 选择器不匹配（可能是 div role=navigation），Task 6 Step 4 失败时改断言。
- **`networkidle` 超时**：若图片/CDN 请求慢，改用 `domcontentloaded` 重试。
- **生产 server 端口**：`-p 3100` 确保不与 dev 3000 冲突；若 3100 被占，换 3101 并同步 `BASE_URL`。
- **`omitBackground: true` 的 maskable 透明角**：maskable 由平台裁切，背景已铺满无圆角，安全。