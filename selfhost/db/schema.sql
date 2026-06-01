CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    display_name TEXT,
    photo_url TEXT,
    spotify_id TEXT UNIQUE,
    spotify_is_premium BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    name TEXT NOT NULL,
    country CHAR(2) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    playback JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parties_short_id_idx ON parties(short_id);
CREATE INDEX IF NOT EXISTS parties_created_by_idx ON parties(created_by);

CREATE TABLE IF NOT EXISTS tracks (
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    track_key TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    played_at TIMESTAMPTZ,
    is_fallback BOOLEAN NOT NULL DEFAULT false,
    vote_count INTEGER NOT NULL DEFAULT 0,
    queue_order DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (party_id, track_key)
);

CREATE INDEX IF NOT EXISTS tracks_queue_order_idx ON tracks(party_id, queue_order);

CREATE TABLE IF NOT EXISTS votes (
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    track_key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (party_id, track_key, user_id)
);

CREATE INDEX IF NOT EXISTS votes_by_user_idx ON votes(party_id, user_id);

