import { z } from 'zod';

import { config, requireConfig } from './config.js';
import { decrypt, encrypt } from './crypto.js';

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
        refreshToken: encrypt(
            requireConfig(body.refresh_token || '', 'spotify refresh_token'),
            requireConfig(config.tokenEncryptionSecret, 'TOKEN_ENCRYPTION_SECRET'),
        ),
        tokenType: body.token_type,
    };
}

export async function getClientToken() {
    const body = await spotifyTokenRequest({ grant_type: 'client_credentials' });

    return {
        accessToken: body.access_token,
        expiresIn: body.expires_in,
    };
}

export async function refreshToken(refreshToken: string) {
    const decryptedRefreshToken = decrypt(
        refreshToken,
        requireConfig(config.tokenEncryptionSecret, 'TOKEN_ENCRYPTION_SECRET'),
    );
    const body = await spotifyTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: decryptedRefreshToken,
    });

    return {
        accessToken: body.access_token,
        expiresIn: body.expires_in,
    };
}

