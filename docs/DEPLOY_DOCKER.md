# Docker deploy

This container builds the static Festify frontend and serves it with nginx.

Festify still needs Firebase Realtime Database, Firebase Cloud Functions, and a
Spotify application to work. The container does not replace those services.

## Required local config files

Create these files in the repository root before building:

```bash
cp common.config.example.js common.config.js
cp firebase.config.example.js firebase.config.js
cp spotify.config.example.js spotify.config.js
cp backend.config.example.js backend.config.js
```

Then edit the copied files with your real Firebase, Spotify, Fanart.tv, and
Sentry values. The real files are ignored by git. They are included in the
Docker build because the app imports them at compile time.

Keep `BACKEND_TYPE = "firebase"` while using the current Firebase backend.

## Build and run

```bash
docker compose up -d --build
```

The frontend will be available at:

```text
http://localhost:8088
```

If you deploy behind a public hostname, add that origin to the Spotify
application redirect URLs, for example:

```text
https://festify.example.com
```

