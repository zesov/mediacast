# next-podcast

A podcast web player built with **Next.js 16 (App Router)**, TypeScript, and Tailwind CSS.
It surfaces global media from the **Podcast Index API** and **Free-TV/IPTV** with
**PeerTube** integration, featuring a bilingual (Chinese/English) UI and
privacy-preserving playback tracking via Deno KV.

## Features

- Podcast browsing & playback by feed
- Live TV / Free-TV/IPTV with m3u parsing and proxying
- PeerTube video search and browsing (SepiaSearch API)
- Featured episode carousel (react-slick)
- Bilingual UI (next-intl, `zh` / `en`)
- Privacy-safe playback tracking: IP hashing, no PII stored

## Getting Started

### Prerequisites

Copy the environment template and fill in your keys:

```bash
cp .env.example .env
# Then add your real PODCAST_INDEX_KEY / PODCAST_INDEX_SECRET / ADMIN_TOKEN / IP_HASH_SALT
```

### Development

```bash
npm run dev
# → http://localhost:3000
```

### Building

```bash
npm run build      # production build + TypeScript typecheck via Turbopack
npm run start        # start the production server
```

### Verification

```bash
npm run lint         # ESLint (TypeScript + React rules)
npm test             # Vitest unit tests
npm run build        # production build + type check
```

> Tests: **12 files, 163 tests**. Coverage focuses on playback tracking, security
> primitives (rate limiting, admin auth, IP extraction), and API input validation.

## Architecture Notes

- **Server vs Client components**: server components import the Podcast Index
  client directly from `app/api/db.ts`; client components fetch via internal
  API routes (`/api/podcastById?id=...`, `/api/episodesByFeedId?id=...`).
- **Playback tracking**: `lib/analytics.ts` + `hooks/usePlaybackTracking.ts`;
  requires `DENO_KV_URL` / `DENO_KV_TOKEN` in production, memory fallback in dev.
- **Mock data**: MSW intercepts `/api/*` when `NEXT_PUBLIC_MSW_ENABLE=true`.

## Deploy

Designed for Vercel (Serverless Functions for API routes). Follow the
[Next.js deployment guide](https://nextjs.org/docs/app/building-your-application/deploying)
for details.

## Agent Notes
- The repo carries an `AGENTS.md` with project-specific conventions.
- Do not commit `.env`; do not auto-commit without explicit request.
