# Changelog

## [1.0.2] - 2026-10-24
### Added

- Live TV player keyboard shortcuts:
  - `F` — toggle fullscreen
  - `C` — toggle captions (CC)
  - `P` — toggle play/pause
  - `M` — toggle mute
- Spacebar toggles play/pause in Live TV player
- Live TV player: click on video area to toggle play/pause
- Live TV player: auto-hide control bar in fullscreen (mouse idle → hide, move → show)
- When controls hidden in fullscreen, title bar, control bar fully collapse and video expands to full screen (h-[100vh] object-cover)

### Fixed

- Vercel production build failure caused by unhandled Podcast Index API errors during static page generation (e.g. `Error: Unauthorized` on prerendering `/zh`). API calls to the Podcast Index now resolve gracefully with fallback data when the upstream API is unreachable or returns errors, so `npm run build` completes successfully.