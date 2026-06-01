import type {} from '@fastify/cookie';
import { FastifyRequest } from 'fastify';

import { verifySessionToken } from './auth.js';
import { pool } from './db.js';

export interface SessionUser {
    id: string;
    email: string | null;
    displayName: string | null;
    photoUrl: string | null;
    spotifyId: string | null;
    spotifyIsPremium: boolean;
}

export async function requireSessionUser(request: FastifyRequest): Promise<SessionUser> {
    // Try httpOnly cookie first (new path), fall back to Bearer header (backward compat)
    let token: string | undefined = request.cookies?.sessionToken;

    if (!token) {
        const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '');
        if (match) {
            token = match[1];
        }
    }

    if (!token) {
        throw new Error('Missing bearer token.');
    }

    const userId = verifySessionToken(token);
    const result = await pool.query(
        `SELECT id, email, display_name, photo_url, spotify_id, spotify_is_premium
         FROM users
         WHERE id = $1`,
        [userId],
    );

    if (result.rowCount !== 1) {
        throw new Error('Session user not found.');
    }

    const row = result.rows[0];
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        photoUrl: row.photo_url,
        spotifyId: row.spotify_id,
        spotifyIsPremium: row.spotify_is_premium,
    };
}
