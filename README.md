<a href="https://festify.rocks/">
    <img title="Festify Logo" height="150" src="https://festify.rocks/img/festify-logo.svg">
</a>

# Festify

Festify is a free Spotify-powered app that lets your guests choose which music should be played using their smartphones.

Two backend modes are supported:

| Mode | Status | Description |
|------|--------|-------------|
| **Self-hosted** | ✅ Active | Fastify + PostgreSQL backend. Full control, no Firebase dependency. |
| **Firebase** | 🔧 Legacy | Original Firebase Realtime Database + Cloud Functions backend. Still functional during migration. |

---

## Self-hosted quickstart

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [Spotify Developer Application](https://developer.spotify.com/dashboard) (Premium account required to host parties)

### 1. Configure

Copy the example files and fill in your values:

```bash
cp backend.config.example.js backend.config.js
cp spotify.config.example.js spotify.config.js
cp common.config.example.js common.config.js
cp selfhost/.env.example selfhost/.env
```

**`backend.config.js`** — select backend and set API URL:
```js
export const BACKEND_TYPE = "self-hosted";
export const SELF_HOSTED_API_URL = "http://localhost:8088";
export const SELF_HOSTED_REALTIME_URL = "";
```

**`selfhost/.env`** — backend secrets:
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
TOKEN_ENCRYPTION_SECRET=generate_a_long_random_string
FESTIFY_ALLOWED_HOST_EMAILS=your@email.com
PUBLIC_ORIGIN=http://localhost:8088
```

**`spotify.config.js`** — Spotify client ID for the frontend:
```js
export const CLIENT_ID = "your_spotify_client_id";
```

In your Spotify Developer Application, add `http://localhost:8088` as a Redirect URI.

### 2. Run

```bash
docker compose up --build
```

The app is available at **http://localhost:8088**.

On first start, the backend automatically runs database migrations against the PostgreSQL container.

### 3. Production deployment

For production, set `PUBLIC_ORIGIN` to your public domain and put a TLS-terminating reverse proxy (nginx, Caddy, etc.) in front. The proxy should route:

- `/api/*` → backend on port 8089
- `/*` → frontend on port 8088

Both ports must be bound to `127.0.0.1` only (the default in `docker-compose.yml`).

---

## Development

### Frontend

```bash
yarn install
yarn serve        # dev server with live reload on port 3000
yarn build        # production bundle → /build
yarn lint         # tslint
```

Config files (`backend.config.js`, `spotify.config.js`, `firebase.config.js`, `common.config.js`) are loaded as ES modules at build time. Rollup will report missing files.

### Self-hosted backend

```bash
cd selfhost
npm install
npm run dev       # tsx watch, restarts on file changes
npm run migrate   # run pending migrations manually
```

Requires a running PostgreSQL instance. Set `DATABASE_URL` in `selfhost/.env`.

---

## Firebase (legacy) setup

> The Firebase path is kept working during the migration to self-hosted. New deployments should use self-hosted.

### Additional prerequisites

- A [Firebase](https://firebase.google.com) project (Blaze plan required for Cloud Functions)
  - Enable Anonymous authentication
  - Optionally enable GitHub, Facebook, Twitter, and Google for cheat-prevention
- [Fanart.tv](https://fanart.tv) API key for TV Mode artwork
- [Sentry](https://sentry.io) DSN for error reporting

### Config files

**`backend.config.js`**:
```js
export const BACKEND_TYPE = "firebase";
export const SELF_HOSTED_API_URL = "";
export const SELF_HOSTED_REALTIME_URL = "";
```

**`firebase.config.js`**:
```js
export default {
    apiKey: "...",
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
};
```

**`functions/service-account.json`**: Firebase Admin SDK private key from Project Settings → Service Accounts.

**`functions/spotify.config.ts`**:
```ts
export const CLIENT_ID = "...";
export const CLIENT_SECRET = "...";
export const ENCRYPTION_SECRET = "...";
```

---

## Contributing

1. Fork and create a feature branch: `git checkout -b my-improvement`
2. Make changes and test them
3. Commit and push, then open a pull request

See [AGENTS.md](AGENTS.md) for working rules on the self-hosted migration.

---

## License

LGPLv3
