# AGENTS.md

**Generated:** 2026-09-11 17:20:00
**Commit:** d1e18a4
**Branch:** dev

## OVERVIEW
A podcast web player (Next.js 16 App Router) that surfaces global media cast from the Podcast Index API and Free-TV/IPTV with PeerTube integration, featuring bilingual UI (Chinese/English) and privacy-preserving playback tracking.

## STRUCTURE
```
next-podcast/
├── app/                    # Next.js App Router - server components and API routes
│   ├── [locale]/           # Internationalized routes (zh, en)
│   │   ├── page.tsx        # Home page with random category podcasts
│   │   ├── layout.tsx      # Locale-specific layout with i18n and PWA
│   │   ├── live/           # Live TV routes
│   │   ├── podcast/        # Podcast browsing and episode pages
│   │   └── peertube/       # PeerTube video search and browsing
│   ├── api/                # API route handlers
│   │   ├── db.ts           # Podcast Index client configuration
│   │   ├── podcastById/    # Podcast metadata endpoint
│   │   ├── episodesByFeedId/ # Podcast episodes endpoint
│   │   ├── track/          # Playback tracking endpoints
│   │   └── youtube/        # YouTube live stream proxy
│   ├── contexts/           # React context providers
│   │   └── EpisodeContext.ts # Playback state sharing
│   ├── types.ts            # TypeScript interfaces for API responses
│   ├── manifest.ts         # PWA manifest configuration
│   └── globals.css         # Global styles and Tailwind configuration
├── components/             # Reusable UI components
│   ├── main.tsx            # Home page layout
│   ├── Navbar.tsx          # Navigation with language switcher
│   ├── SearchInput.tsx     # Search with PeerTube filters
│   ├── Player.tsx          # Audio/video player with tracking
│   └── Footer.tsx          # Site footer with disclaimers
├── lib/                    # Utility libraries
│   ├── analytics.ts        # Deno KV proxy for playback tracking
│   ├── privacy.ts          # IP hashing and user agent parsing
│   └── deno/               # Deno KV proxy server
├── hooks/                  # Custom React hooks
│   └── usePlaybackTracking.ts # Playback event tracking
├── tests/                  # Unit tests
│   └── (PeerTube filtering tests)
├── public/                 # Static assets
│   └── icons/              # PWA icons
├── i18n/                   # Internationalization configuration
│   └── routing.ts          # Next.js i18n routing (zh, en)
├── messages/               # Translation files
│   ├── en/                 # English translations
│   └── zh/                 # Chinese translations
├── docs/                   # Documentation
│   └── superpowers/        # Skill specifications
├── mocks/                  # MSW mock data for development
│   ├── data.ts             # Mock podcast/episode data
│   └── handlers.ts         # MSW request handlers
├── scripts/                # Utility scripts
├── .env                    # Environment variables (PODCAST_INDEX_KEY, DENO_KV_*)
├── .env.example            # Example environment variables
├── next.config.ts          # Next.js configuration (image domains)
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Understanding data flow | AGENTS.md | Section "Data flow (critical to understand before editing)" |
| Adding new podcast feature | app/[locale]/podcast/ | Follow existing patterns in podcast/ directory |
| Adding new live TV feature | app/[locale]/live/ | LiveTvPage component handles Free-TV/IPTV |
| Adding PeerTube feature | app/[locale]/peertube/ | PeerTubePage component with filtering |
| Modifying playback tracking | lib/analytics.ts & hooks/usePlaybackTracking.ts | Privacy-safe tracking with Deno KV |
| Changing UI styling | app/globals.css & components/ | Tailwind v4 with custom slick overrides |
| Adding API endpoint | app/api/ | Create route.ts file following existing patterns |
| Adding new component | components/ | Follow existing component patterns |
| Changing internationalization | i18n/routing.ts & messages/ | next-intl configuration |
| Modifying build/next config | next.config.ts & tsconfig.json | Turbopack and TypeScript settings |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| PlaybackKeys | constant | lib/analytics.ts:8 | 7 | Key builder for Deno KV storage |
| PlaybackSession | interface | lib/analytics.ts:21 | 12 | Structure for playback tracking sessions |
| Episode | interface | app/types.ts:20 | 12 | Core data model for podcast episodes |
| EpisodeProvider | component | app/contexts/EpisodeContext.tsx:17 | 6 | React context provider for playback state |
| useEpisode | hook | app/contexts/EpisodeContext.tsx:36 | 6 | Custom hook to consume EpisodeContext |
| Player | component | components/Player.tsx:22 | 5 | Audio/video player with tracking controls |
| EpisodeFeedPage | component | components/Podcast/EpisodeFeed.tsx:27 | 2 | Podcast episode details and playlist |
| PodcastPage | component | components/Podcast/Podcast.tsx:13 | 4 | Podcast browse and episode listing |
| Main | component | components/main.tsx:32 | 2 | Home page layout with podcast/live sections |
| Navbar | component | components/Navbar.tsx:10 | 3 | Navigation with search and language switcher |
| SearchInput | component | components/SearchInput.tsx:73 | 2 | Search bar with PeerTube filter dropdown |
| PeerTubeFilters | component | components/PeerTube/PeerTubeFilters.tsx:247 | 4 | Filter UI for PeerTube search |
| LiveTvPage | component | components/LiveTV/LiveTvPage.tsx:10 | 2 | Free-TV/IPTV live TV player |
| FreeTVGuide | component | components/FreeTV/FreeTVGuide.tsx:12 | 2 | Electronic program guide for live TV |

## CONVENTIONS
- **TypeScript is loose**: `any` and `// @ts-ignore` used liberally in components - match surrounding looseness rather than introducing strict typing
- **Bilingual UI**: Text and comments mix English and Simplified Chinese - preserve this style
- **Path alias**: `@/*` maps to repo root - use for imports (e.g., `@/components/...`)
- **Tailwind v4**: Configured via `@import "tailwindcss"` in globals.css with postcss plugin
- **react-slick**: CSS must be imported (slick.css + slick-theme.css) for carousel components
- **Next.js 15+**: Route `params` are async - always use `const { id } = await params`
- **Image whitelist**: `next.config.ts` whitelists all remote hosts (`hostname: '**'`) for arbitrary podcast artwork
- **Environment**: `.env` holds `PODCAST_INDEX_KEY` (gitignored); App Secret hardcoded in `app/api/db.ts`
- **Raw endpoints**: `client.raw(path)` used for Podcast Index endpoints not in official client, results cast with `as`

## ANTI-PATTERNS (THIS PROJECT)
- **Mixing fetch paths**: Server components must import Podcast Index client directly from `app/api/db.ts`; client components must fetch via internal API routes (`/api/podcastById?id=...`, `/api/episodesByFeedId?id=...`)
- **Stale tsconfig entry**: Do not remove `"podcast/[id]/page.js"` from tsconfig.json include without verifying nothing depends on it
- **Untracked scratch dir**: Do not commit `.code-context/` directory (used by agents)
- **Missing PWA assets**: Ensure icons/icon-192.png and icons/icon-512.png exist in public/
- **Blocking navigation**: Tracking requests use `keepalive: true` for end events to prevent navigation cancellation
- **Hardcoded secrets**: Do not rotate Podcast Index App Secret in `app/api/db.ts` without updating `.env` and podcastdx account
- **Test infra**: No automated test suite exists - verify changes via `npm run build` + manual dev-server check

## UNIQUE STYLES
- **Privacy-first tracking**: IP addresses hashed, anonymous session IDs, no PII stored in playback tracking
- **Featured carousel**: Custom implementation with react-slick for dynamic podcast recommendations
- **Language switching**: Preserves current path when switching between Chinese and English locales
- **Mock data strategy**: MSW intercepts API calls in development when `NEXT_PUBLIC_MSW_ENABLE=true`
- **Deno KV integration**: Uses Deno Deploy KV for persistent playback tracking with HTTP proxy fallback
- **Live TV integration**: Free-TV/IPTV API integrated via custom m3u parsing and proxy endpoints
- **PeerTube integration**: SepiaSearch API integration with faceted search and filtering UI

## COMMANDS
```bash
# Development
bun dev                    # Start Turbopack dev server
npm run dev                # Alternative with npm

# Building
npm run build              # Create production build with Turbopack
npm run start              # Start production server

# Verification
npm run lint               # Run ESLint (only verification - no typecheck script)
npm run build              # Typecheck via build (no separate typecheck script)

# Environment
cp .env.example .env       # Create environment file (add PODCAST_INDEX_KEY)
```

## NOTES
- **tsconfig.json gotcha**: The `include` array references `podcast/[id]/page.js` (stale) - the real file is `app/podcast/[id]/page.tsx`. Do not "fix" without verifying nothing depends on it.
- **Agent scratch dir**: `.code-context/` is untracked - do not commit
- **Test infrastructure**: No test suite exists; add behavior and verify via `npm run build` + manual dev-server check
- **Package manager**: Uses both `bun.lock` and `package-lock.json` - use `bun` for installs but retain both lockfiles
- **ESLint limitation**: Only `next/core-web-vitals` and `next/typescript` extensions used; no custom rules
- **Build output**: `.next/` directory contains compiled output - do not commit
- **Routing**: All pages under `/[locale]/` require locale prefix; use `next-intl` routing for language switching
- **Media handling**: Artwork/audio URLs come from arbitrary podcast RSS feeds - next.config.ts whitelists all hosts
- **Deployment**: Designed for Vercel deployment with Serverless Functions for API routes
- **Playback tracking**: Requires DENO_KV_URL and DENO_KV_TOKEN for production; uses memory fallback in development
- **PeerTube security**: Content is loaded via sandboxed iframe with strict CSP in PeerTubeVideo element
- **Live TV stability**: Free-TV/IPTV streams may be unreliable - app handles connection errors gracefully

## Important
- 使用frontend-design skills
- omo Delegated tasks任务分配10秒超时无反应后，用主agent直接执行
- TDD测试优先开发模式优先
- 不要自动 git commit，要由user明确提出先commit

### browse playwright
- 直接使用bash命令 uvx playwright 