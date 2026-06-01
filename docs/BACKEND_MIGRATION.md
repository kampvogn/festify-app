# Backend migration

Festify currently uses Firebase directly from the frontend and Firebase Cloud
Functions for Spotify token operations and vote processing.

The migration target is to keep Firebase as the default backend while adding a
self-hosted backend that can be selected at build time.

## Backend selection

Create a local `backend.config.js` from the example:

```bash
cp backend.config.example.js backend.config.js
```

Supported values:

```js
export const BACKEND_TYPE = "firebase";
```

```js
export const BACKEND_TYPE = "self-hosted";
```

The Docker build includes this file at compile time. Firebase remains the
default until the self-hosted adapter implements enough behavior to run the app.

## Self-hosted target

The self-hosted stack should provide:

- HTTP API for Spotify OAuth token exchange, token refresh, and account linking.
- Realtime transport for parties, tracks, votes, playback state, and connection state.
- Persistent storage for users, parties, tracks, votes, and playback state.
- Vote processing that replaces the Firebase database trigger.

Suggested local services:

- `festify-web`: existing frontend container.
- `festify-api`: Node.js/TypeScript API.
- `festify-db`: Postgres.
- `festify-redis`: optional pub/sub for realtime fanout and vote processing.


## Current self-hosted scaffold

The repository now contains an initial `selfhost` service. It exposes:

- `GET /health`
- `POST /api/spotify/client-token`
- `POST /api/spotify/exchange-code`
- `POST /api/spotify/refresh-token`

The Spotify endpoints match the data shape returned by the Firebase callable
functions, but the frontend still calls Firebase. The next adapter step is to
route Spotify token operations through `BACKEND_TYPE`.

To run the scaffold locally:

```bash
cp .env.example .env
# edit .env with Spotify credentials and a long token secret
docker compose up -d --build festify-api festify-db
```

The API listens on `http://localhost:8089`.

## Migration order

1. Keep Firebase deploy working.
2. Move frontend imports behind small backend modules instead of direct
   `firebase.database()` and `firebase.auth()` calls.
3. Implement the self-hosted API with the same frontend-facing methods.
4. Switch one vertical flow at a time: auth, party creation, party realtime
   reads, queue/votes, playback state.
5. Remove Firebase only after `BACKEND_TYPE = "self-hosted"` can cover the full
   app.

## Roadmap

See [SELF_HOSTED_ROADMAP.md](SELF_HOSTED_ROADMAP.md) for the current phase plan,
exit criteria, and the UI modernization policy.

