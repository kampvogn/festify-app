import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { config, requireConfig } from './config.js';
import { pool } from './db.js';

const TOKEN_VERSION = 'v1';

export interface ApiUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    isAnonymous: boolean;
    providerId: string;
    spotifyIsPremium: boolean;
}

function base64Url(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
}

function sign(payload: string): string {
    return createHmac('sha256', requireConfig(config.tokenEncryptionSecret, 'TOKEN_ENCRYPTION_SECRET'))
        .update(payload)
        .digest('base64url');
}

export function createSessionToken(userId: string): string {
    const payload = `${TOKEN_VERSION}.${base64Url(JSON.stringify({ sub: userId, iat: Date.now() }))}`;
    return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string {
    const [version, payload, signature] = token.split('.');
    if (version !== TOKEN_VERSION || !payload || !signature) {
        throw new Error('Invalid session token.');
    }

    const signedPayload = `${version}.${payload}`;
    const expected = sign(signedPayload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
        providedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
        throw new Error('Invalid session signature.');
    }

    const claims = z.object({ sub: z.string().uuid() }).parse(
        JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
    );
    return claims.sub;
}

function rowToApiUser(row: any, isAnonymous: boolean): ApiUser {
    return {
        uid: row.id,
        email: row.email,
        displayName: row.display_name,
        photoURL: row.photo_url,
        isAnonymous,
        providerId: isAnonymous ? 'anonymous' : 'spotify',
        spotifyIsPremium: Boolean(row.spotify_is_premium),
    };
}

export async function createAnonymousSession() {
    const result = await pool.query(
        `INSERT INTO users (display_name)
         VALUES ($1)
         RETURNING id, email, display_name, photo_url, spotify_is_premium`,
        ['Guest'],
    );
    const user = rowToApiUser(result.rows[0], true);

    return {
        sessionToken: createSessionToken(user.uid),
        user,
    };
}

export async function upsertSpotifySession(accessToken: string) {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Spotify profile request failed with ${response.status}: ${body}`);
    }

    const spotifyUser = z.object({
        id: z.string(),
        display_name: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        product: z.string().nullable().optional(),
        images: z.array(z.object({ url: z.string().url() })).optional(),
    }).parse(await response.json());

    const photoUrl = spotifyUser.images && spotifyUser.images.length > 0
        ? spotifyUser.images[0].url
        : null;
    const displayName = spotifyUser.display_name || spotifyUser.id;
    const spotifyId = `spotify:user:${spotifyUser.id}`;

    const result = await pool.query(
        `INSERT INTO users (email, display_name, photo_url, spotify_id, spotify_is_premium)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (spotify_id) DO UPDATE SET
             email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             photo_url = EXCLUDED.photo_url,
             spotify_is_premium = EXCLUDED.spotify_is_premium,
             updated_at = now()
         RETURNING id, email, display_name, photo_url, spotify_is_premium`,
        [spotifyUser.email || null, displayName, photoUrl, spotifyId, spotifyUser.product === 'premium'],
    );
    const user = rowToApiUser(result.rows[0], false);

    return {
        sessionToken: createSessionToken(user.uid),
        user,
    };
}

export function assertAllowedHostEmail(email: string | null): void {
    if (config.allowedHostEmails.length === 0) {
        return;
    }

    if (!email || !config.allowedHostEmails.includes(email.toLowerCase())) {
        throw new Error('This Spotify account is not allowed to host parties.');
    }
}
