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
// 只捕获真实 JS 异常（pageerror）；console.error 里的离线网络错误是模拟断网时的预期行为，不算 PWA 缺陷
page.on("pageerror", (e) => errors.push(e.message));

// 1. manifest 可访问且字段齐全
const manifestRes = await page.goto(`${BASE}/manifest.webmanifest`);
if (manifestRes.status() !== 200) {
  throw new Error(`manifest status ${manifestRes.status()}`);
}
const manifest = await manifestRes.json();
const expect = {
  name: "Mediacast",
  start_url: "/zh",
  theme_color: "#4f46e5",
  display: "standalone",
};
for (const [k, v] of Object.entries(expect)) {
  if (manifest[k] !== v) {
    throw new Error(`manifest.${k}=${JSON.stringify(manifest[k])}, expect ${v}`);
  }
}

// 2. 加载 /zh，等 SW ready + controller
await page.goto(`${BASE}/zh`, { waitUntil: "domcontentloaded" });
await page.locator("nav").first().waitFor({ timeout: 15000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });

// 缓存填充：二次加载（HTML + static chunks 全部入缓存）
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("nav").first().waitFor({ timeout: 15000 });

// 3. 核心：模拟离线 → 刷新 → App Shell 仍渲染
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0,
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("nav").first().waitFor({ timeout: 15000 });
if (await page.getByText("Offline", { exact: true }).count()) {
  throw new Error("offline reload returned the synthetic Offline page");
}
// 恢复在线
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});

if (errors.length) {
  throw new Error(`page errors: ${errors.join(" | ")}`);
}

await browser.close();
console.log("PWA VERIFY PASS");