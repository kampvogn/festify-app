import { randomInt } from 'node:crypto';
import { z } from 'zod';

import { assertAllowedHostEmail } from './auth.js';
import { pool } from './db.js';
import { SessionUser } from './session.js';

const createPartySchema = z.object({
    displayName: z.string().min(1),
    name: z.string().min(1).optional(),
    country: z.string().length(2),
    settings: z.record(z.any()),
});

function possessiveName(displayName: string): string {
    return displayName.endsWith('s') ? `${displayName}' Party` : `${displayName}'s Party`;
}

function randomShortId(): string {
    return String(randomInt(1000000)).padStart(6, '0');
}

function defaultPlayback(createdAt: number) {
    return {
        last_change: createdAt,
        last_position_ms: 0,
        master_id: null,
        playing: false,
        target_playing: null,
    };
}

export function rowToParty(row: any) {
    const createdAt = new Date(row.created_at).getTime();
    return {
        id: row.id,
        country: row.country,
        created_at: createdAt,
        created_by: row.created_by,
        name: row.name,
        playback: row.playback || defaultPlayback(createdAt),
        settings: row.settings || {},
        short_id: row.short_id,
    };
}

export async function createParty(input: unknown, user: SessionUser) {
    if (!user.spotifyId) {
        throw new Error('A linked Spotify account is required to host parties.');
    }
    if (!user.spotifyIsPremium) {
        throw new Error('To create parties and play music on Festify, you need a Spotify Premium account.');
    }
    assertAllowedHostEmail(user.email);

    const data = createPartySchema.parse(input);
    const partyName = data.name || possessiveName(data.displayName);
    const playback = {
        last_change: Date.now(),
        last_position_ms: 0,
        master_id: null,
        playing: false,
        target_playing: null,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
        const shortId = randomShortId();
        const result = await pool.query(
            `INSERT INTO parties (short_id, created_by, name, country, settings, playback)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, short_id, created_by, name, country, settings, playback, created_at`,
            [shortId, user.id, partyName, data.country, data.settings, playback],
        );

        return rowToParty(result.rows[0]);
    }

    throw new Error('Failed to allocate party code.');
}

export async function resolveShortId(shortId: string): Promise<string | null> {
    const result = await pool.query(
        `SELECT id
         FROM parties
         WHERE short_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [shortId],
    );

    return result.rowCount ? result.rows[0].id : null;
}

export async function getParty(id: string) {
    const result = await pool.query(
        `SELECT id, short_id, created_by, name, country, settings, playback, created_at
         FROM parties
         WHERE id = $1`,
        [id],
    );

    return result.rowCount ? rowToParty(result.rows[0]) : null;
}
