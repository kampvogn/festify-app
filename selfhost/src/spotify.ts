import { z } from 'zod';

import { config, requireConfig } from './config.js';
import { decrypt, encrypt } from './crypto.js';
import { pool } from './db.js';

const tokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number(),
    refresh_token: z.string().optional(),
    token_type: z.string().optional(),
});

function authHeader(): string {
    const clientId = requireConfig(config.spotifyClientId, 'SPOTIFY_CLIENT_ID');
    const clientSecret = requireConfig(config.spotifyClientSecret, 'SPOTIFY_CLIENT_SECRET');
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function spotifyTokenRequest(params: Record<string, string>) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: authHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Spotify token request failed with ${response.status}: ${body}`);
    }

    return tokenResponseSchema.parse(await response.json());
}

export async function exchangeCode(callbackUrl: string, code: string) {
    const body = await spotifyTokenRequest({
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
        code,
    });

    return {
        accessToken: body.access_token,
        expiresIn: body.expires_in,
        // Encrypted refresh token — stored server-side, never sent to the browser
        encryptedRefreshToken: encrypt(
            requireConfig(body.refresh_token || '', 'spotify refresh_token'),
            requireConfig(config.tokenEncryptionSecret, 'TOKEN_ENCRYPTION_SECRET'),
        ),
    };
}

export async function getClientToken() {
    const body = await spotifyTokenRequest({ grant_type: 'client_credentials' });

    return {
        accessToken: body.access_token,
        expiresIn: body.expires_in,
    };
}

export async function refreshTokenForUser(userId: string): Promise<{ accessToken: string; expiresIn: number }> {
    const result = await pool.query<{ spotify_refresh_token: string | null }>(
        'SELECT spotify_refresh_token FROM users WHERE id = $1',
        [userId],
    );

    const encryptedToken = result.rows[0]?.spotify_refresh_token;
    if (!encryptedToken) {
        throw new Error('No Spotify refresh token on file. Please reconnect your Spotify account.');
    }

    const decryptedToken = decrypt(
        encryptedToken,
        requireConfig(config.tokenEncryptionSecret, 'TOKEN_ENCRYPTION_SECRET'),
    );

    const body = await spotifyTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: decryptedToken,
    });

    // Spotify may rotate the refresh token — store the latest one
    if (body.refresh_token) {
        await pool.query(
            'UPDATE users SET spotify_refresh_token = $1, updated_at = now() WHERE id = $2',
            [
                encrypt(body.refresh_token, requireConfig(config.tokenEncryptionSecret, 'TOKEN_ENCRYPTION_SECRET')),
                userId,
            ],
        );
    }

    return {
        accessToken: body.access_token,
        expiresIn: body.expires_in,
    };
}
