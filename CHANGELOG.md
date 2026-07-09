# Changelog

All notable changes to Festify will be recorded here.

The project stays on `0.x.y` while the self-hosted migration is still in progress.

## Unreleased

### Added

- Search now covers albums and playlists in addition to tracks, with results grouped into three sections. Tapping an album or playlist drills into its tracks, which can be voted on individually.
- A new React 18 + Vite + Tailwind UI lives alongside the Polymer app under `src-react/` (`npm run dev` / `npm run build:react`). All views have been ported; the Polymer app remains the production entry point until switchover.
- Spotify Connect device selection is now available on the host path, with playback transfer from the party header.
- The currently playing queue item now shows visible track progress and elapsed time.
- Self-hosted party screens now subscribe to API-pushed snapshot events over SSE instead of relying on manual refresh.

### Changed

- Host queue mutations and playback state now round-trip through the self-hosted Postgres API.
- Self-hosted party pages hydrate from backend snapshots without Firebase listeners on the host path.
- Self-hosted party screens now auto-refresh from backend snapshots while open, so guest and host tabs stay in sync without manual refresh.
- The realtime transport is now moving from polling toward a push-based SSE channel on the self-hosted path.

### Fixed

- Party track search no longer appends a wildcard to Spotify queries, and failed search responses now surface a clean error instead of crashing on missing track data.
- Self-hosted party settings no longer try to touch Firebase when fallback playlists are inserted.
- Firebase initialization is now skipped entirely in self-hosted mode, preventing invalid placeholder config crashes.
- The live backend config now points to the self-hosted API on festify.kampvogn.dk instead of the Firebase mode placeholder.
- App startup now logs bundle version and backend mode in the browser console for deployment verification.

### Removed

- 

## 0.1.0

Initial tracked baseline for the current migration work.

### Added

- Self-hosted backend scaffold.
- Spotify OAuth/token handling behind the backend adapter.
- Self-hosted party creation and host gating.
- Deployment docs for Docker and Nginx.
- Migration roadmap and repo working rules.

### Changed

- Frontend/backend wiring now supports a self-hosted mode alongside Firebase.

### Fixed

- 

### Removed

- 
