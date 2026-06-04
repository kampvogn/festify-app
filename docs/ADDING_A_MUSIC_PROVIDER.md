# Adding a new music provider

Festify's music service layer is built around a `MusicProvider` interface. Adding a new provider (e.g. Apple Music, YouTube Music) requires changes in four areas: frontend implementation, provider registration, backend auth, and database.

---

## 1. Implement the `MusicProvider` interface

Create `src/util/providers/<name>-provider.ts` and implement every method in `MusicProvider` (`src/util/music-provider.ts`):

```typescript
import { MusicProvider, SearchResult, WebPlayerHandle } from '../music-provider';
import { Metadata, PlayerDevice } from '../../state';

export class AppleMusicProvider implements MusicProvider {
    readonly name = 'apple-music';

    getUserToken(): Promise<string> { /* ... */ }
    getClientToken(): Promise<string> { /* ... */ }

    search(query: string, countryCode: string, limit?: number): Promise<SearchResult[]> { /* ... */ }
    getMetadata(ids: string[], countryCode: string): Promise<Record<string, Metadata>> { /* ... */ }

    getDevices(): Promise<PlayerDevice[]> { /* ... */ }
    transferPlayback(deviceId: string): Promise<void> { /* ... */ }
    setVolume(volumePercent: number): Promise<void> { /* ... */ }

    initWebPlayer(): Promise<WebPlayerHandle> { /* ... */ }
    play(deviceId: string, trackId: string, positionMs: number): Promise<void> { /* ... */ }
}

export const appleMusicProvider = new AppleMusicProvider();
```

### Interface contracts

| Method | Returns | Notes |
|--------|---------|-------|
| `getUserToken()` | OAuth access token for the signed-in user | Used for playback and device control |
| `getClientToken()` | Anonymous/client credentials token | Used for search without a logged-in user |
| `search(query, countryCode, limit?)` | `SearchResult[]` | Results are filtered for explicit content by the saga |
| `getMetadata(ids, countryCode)` | `Record<string, Metadata>` | Keys must follow `${provider}-${id}` format |
| `getDevices()` | `PlayerDevice[]` | Return `[]` if the service has no Connect-style device API |
| `transferPlayback(deviceId)` | `Promise<void>` | Throw if not supported |
| `setVolume(volumePercent)` | `Promise<void>` | `volumePercent` is 0–100 |
| `initWebPlayer()` | `WebPlayerHandle` | Must resolve after the player is ready and connected. Reject on init error. |
| `play(deviceId, trackId, positionMs)` | `Promise<void>` | `positionMs` is milliseconds from track start |

`SearchResult.id` and `Metadata` keys must be stable, unique IDs within the provider's namespace. The full track key used throughout the app is `${provider}-${id}` (e.g. `apple-music-abc123`).

---

## 2. Register the provider

Add the provider to `src/util/provider-registry.ts`:

```typescript
import { appleMusicProvider } from './providers/apple-music-provider';

registry.set(appleMusicProvider.name, appleMusicProvider);
```

That's all the frontend routing needs. Search, metadata, and playback sagas all call `getProvider(ref.provider)` dynamically.

---

## 3. Backend auth endpoints

The self-hosted backend needs endpoints for the new provider's OAuth flow. Add them to `selfhost/src/server.ts`:

```
POST /api/<provider>/client-token    — anonymous token for search
POST /api/<provider>/exchange-code   — exchange auth code for access + refresh token
POST /api/<provider>/refresh-token   — refresh access token
POST /api/<provider>/link-account    — link provider account to session
```

Implement the token logic in `selfhost/src/providers/<name>.ts` (mirroring `selfhost/src/spotify.ts`).

The `link-account` route calls a session upsert function (like `upsertSpotifySession` in `auth.ts`) that fetches the user's profile from the new provider's API and creates or updates the user record.

### Database

The `users` table currently has `spotify_id` and `spotify_is_premium` columns. For a new provider, add a migration in `selfhost/migrations/`:

```sql
ALTER TABLE users ADD COLUMN apple_music_id TEXT UNIQUE;
```

The `tracks`, `votes`, and `votes_by_user` tables are already provider-agnostic — they use `track_key` (`${provider}-${id}`) and a `provider` text column.

---

## 4. Frontend auth flow

Update `src/actions/auth.ts` and `src/sagas/auth.ts` to handle the new provider's OAuth redirect and token exchange, similar to the existing Spotify flow. The new provider should appear as a key in `UserCredentials` (`src/state.ts`) if users can connect it to their account.

---

## What you do NOT need to change

- The Redux state shape for tracks, votes, or queue (all provider-agnostic)
- `src/sagas/view-party-search.ts` — reads provider from the registry
- `src/sagas/metadata.ts` — groups tracks by provider automatically
- `src/sagas/playback-devices.ts` — calls `getProvider('spotify')` explicitly today; update the hardcoded name if the new provider also has Connect-style device management
- `selfhost/src/party-state.ts` — all DB operations use `track_key` and `provider` as strings
- `selfhost/src/server.ts` track endpoints — already accept any `provider` string

---

## Checklist

- [ ] `src/util/providers/<name>-provider.ts` — implements `MusicProvider`
- [ ] `src/util/provider-registry.ts` — registered on startup
- [ ] `selfhost/src/providers/<name>.ts` — token exchange and refresh
- [ ] `selfhost/src/server.ts` — auth endpoints for the new provider
- [ ] `selfhost/migrations/` — migration for new user columns if needed
- [ ] `src/actions/auth.ts` / `src/sagas/auth.ts` — OAuth flow
- [ ] `src/state.ts` `UserCredentials` — new provider key if account linking is supported
- [ ] Manual test: search, add to queue, vote, playback on the new provider
