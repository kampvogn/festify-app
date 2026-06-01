# Self-hosted roadmap

This document tracks the migration from Firebase-backed Festify to a self-hosted
backend. The goal is to keep the app usable while replacing the Firebase
dependencies one flow at a time.

## Goal

Run Festify with:

- a self-hosted API
- a self-hosted database
- Spotify OAuth handled by the API
- no Firebase dependency for the main party flows

## Current state

Already in place:

- frontend can switch between `firebase` and `self-hosted`
- self-hosted API handles Spotify token exchange and account linking
- self-hosted API stores users, sessions, parties, tracks, and votes in Postgres
- host creation is restricted by:
  - Spotify account linkage
  - Premium status
  - host email allowlist

Still Firebase-backed:

- legacy Firebase realtime listeners on the remaining non-self-hosted path
- some party-room screens still assume Firebase-style event streams
- Spotify device selection / playback transfer

Implemented on the self-hosted path:

- host queue mutations now round-trip through the API
- playback state persistence now round-trips through the API
- party pages load from backend snapshots without Firebase listeners on the host path
- host playback can load Spotify Connect devices and transfer playback from the party header
- self-hosted party screens now subscribe to API-pushed snapshot events over SSE

## Phase 1: Host path

Scope:

- create party from the host/admin side
- resolve party codes
- open party page from a self-hosted party
- keep host gating correct

Exit criteria:

- host can create a party without Firebase
- host can reach the party screen
- host creation is blocked for non-Premium or non-allowlisted accounts

## Phase 2: Host queue and playback

Scope:

- admin queue actions
- add track to queue
- remove/reorder tracks
- start/stop playback
- choose a Spotify Connect device for playback
- transfer playback to the selected device
- keep playback state consistent after reload

Progress:

- host queue mutations now use the self-hosted API
- playback state now persists in the self-hosted API
- opening a self-hosted party hydrates from a backend snapshot
- the host can browse Spotify Connect devices and transfer playback to the selected device

Exit criteria:

- host can add tracks and hear them play
- host can select a playback device and transfer playback to it
- queue state survives a page refresh
- playback master state is restored from the backend

## Phase 3: Guest participation

Scope:

- join party by short code
- guest track search
- add tracks to queue
- vote up/down
- anonymous voter handling

Exit criteria:

- guests can join and interact without Firebase
- votes update the queue deterministically
- guest actions are reflected in the host view

## Phase 4: Realtime transport

Scope:

- replace the temporary self-hosted polling refresh with a push-based realtime channel over WebSocket or SSE
- keep the first implementation Redis-free; broadcast directly from the API against Postgres and only introduce Redis if we later need multi-instance fanout
- broadcast party state changes
- broadcast queue and vote changes
- handle disconnect and reconnection cleanly

Progress:

- self-hosted party screens currently auto-refresh from backend snapshots while open
- the self-hosted path now has an SSE snapshot stream for open party screens

Exit criteria:

- party screens update without manual refresh
- reconnect restores current state
- no Firebase realtime listeners remain on the main path

## Phase 5: Cleanup and modernization

Scope:

- remove Firebase-specific code paths
- remove dead auth and saga branches
- simplify backend adapters
- modernize the UI only where it helps the host and guest flows

Exit criteria:

- `BACKEND_TYPE = "self-hosted"` covers the full app
- Firebase can be removed or kept only as an optional legacy mode
- the party and queue screens are easier to maintain

## UI modernization policy

Do not rewrite the frontend wholesale before the functional migration is done.
Modernize only the screens that are part of the active host/guest flows:

- party page
- queue/search views
- guest interaction surfaces

Defer larger visual or framework changes until the data model no longer depends
on Firebase semantics.

## Immediate next tasks

1. Replace the self-hosted polling refresh with a push-based realtime transport.
2. Remove the remaining Firebase listeners from the main party path.
3. Verify guest join/search/vote end-to-end in the browser.
4. Tighten any remaining host playback edge cases.
