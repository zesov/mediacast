# Session: Favorites Page Redesign

## Objective
- URL change: `/podcast/favorites` → `/favorites`
- Add Live TV & PeerTube favorites to unified favorites page
- Use IndexedDB as unified storage for all favorite types

## Key Changes

### 1. Route
- **Deleted**: `app/[locale]/podcast/favorites/page.tsx`
- **Added**: `app/[locale]/favorites/page.tsx`
- **Navbar**: All links updated to `/favorites`

### 2. Storage Layer (`lib/favoritesStore.ts`)
- **DB version**: 2 (v1 → v2 migration drops old `podcasts` store)
- **Store name**: `favorites` (was `podcasts`)
- **Key schema**: Composite key `"${type}:${id}"` (ensures uniqueness across types)
- **`FavoriteItem`** interface: `{ key, type, id, title, description, image, lastUpdateTime, addedAt, streamUrl?, groupTitle?, uuid?, name?, previewUrl? }`
- **Live migration**: `LiveTvPage` reads `localStorage('live:favorites')` once and migrates to IndexedDB, removes localStorage key
- **PeerTube**: New favorite toggle button on `PeerTubeVideoCard` (uses `div` to avoid nested button HTML error)

### 3. Favorites Page (`app/[locale]/favorites/page.tsx`)
- Aggregates Podcast (IndexedDB), Live TV (IndexedDB), PeerTube (IndexedDB) favorites
- Sectioned display with `t('podcast')`, `t('liveTV')`, `t('peertube')` translations
- Live favorites link includes `?favorite=true&active=<id>` query params

### 4. Live TV (`components/LiveTV/LiveTvPage.tsx`)
- URL params effect: `?favorite=true` sets `activeCategory='favorite'`; `?active=<id>` sets `activeChannel` (after channels load)
- localStorage migration: One-time read on mount, then deletion
- All favorite storage now via IndexedDB

### 5. Translations
- Added to `messages/{en,zh}/podcast.json` under `home` namespace:
  - `podcast`, `liveTV`, `peertube` (section headers)

## Verification
- `npm run build` ✓ (27/27 static pages generated)
- `npx eslint` on modified files ✓ (0 errors on own code; pre-existing warnings only)

## Remaining Issues (Pre-existing)
- 3× `react-hooks/set-state-in-effect` in LiveTvPage (hydration restoration, youtubeEmbed, loadAllChannels) — not introduced by these changes
- `debouncedSearch` unused in LiveTvPage — pre-existing
- `listEmptyText` unused — pre-existing
