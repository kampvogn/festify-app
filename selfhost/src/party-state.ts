import { pool } from './db.js';
import { rowToParty } from './parties.js';
import { SessionUser } from './session.js';

export interface TrackReference {
    provider: string;
    id: string;
}

export interface Track {
    added_at: number;
    is_fallback: boolean;
    order: number;
    reference: TrackReference;
    played_at?: number;
    vote_count: number;
}

export interface PartySnapshot {
    party: ReturnType<typeof rowToParty>;
    tracks: Record<string, Track>;
    userVotes: Record<string, boolean>;
}

function trackKeyFromRef(ref: TrackReference): string {
    return `${ref.provider}-${ref.id}`;
}

function rowToTrack(row: any): Track {
    return {
        added_at: new Date(row.added_at).getTime(),
        is_fallback: row.is_fallback,
        order: Number(row.queue_order),
        played_at: row.played_at ? new Date(row.played_at).getTime() : undefined,
        reference: {
            provider: row.provider,
            id: row.provider_id,
        },
        vote_count: row.vote_count,
    };
}

async function loadTracks(partyId: string): Promise<Record<string, Track>> {
    const result = await pool.query(
        `SELECT track_key, provider, provider_id, added_at, played_at, is_fallback, vote_count, queue_order
         FROM tracks
         WHERE party_id = $1
         ORDER BY queue_order ASC, added_at ASC`,
        [partyId],
    );

    return result.rows.reduce((acc: Record<string, Track>, row: any) => {
        acc[row.track_key] = rowToTrack(row);
        return acc;
    }, {});
}

async function loadUserVotes(partyId: string, userId: string): Promise<Record<string, boolean>> {
    const result = await pool.query(
        `SELECT track_key, enabled
         FROM votes
         WHERE party_id = $1 AND user_id = $2`,
        [partyId, userId],
    );

    return result.rows.reduce((acc: Record<string, boolean>, row: any) => {
        acc[row.track_key] = Boolean(row.enabled);
        return acc;
    }, {});
}

async function loadPartyRow(partyId: string) {
    const result = await pool.query(
        `SELECT id, short_id, created_by, name, country, settings, playback, created_at
         FROM parties
         WHERE id = $1`,
        [partyId],
    );

    return result.rowCount ? rowToParty(result.rows[0]) : null;
}

export async function loadPartySnapshot(partyId: string, userId: string | null): Promise<PartySnapshot | null> {
    const party = await loadPartyRow(partyId);
    if (!party) {
        return null;
    }

    const [tracks, userVotes] = await Promise.all([
        loadTracks(partyId),
        userId ? loadUserVotes(partyId, userId) : Promise.resolve({}),
    ]);

    return { party, tracks, userVotes };
}

async function requirePartyOwner(client: { query: (query: string, params?: any[]) => Promise<any> }, partyId: string, user: SessionUser): Promise<void> {
    const result = await client.query(
        `SELECT created_by
         FROM parties
         WHERE id = $1`,
        [partyId],
    );

    if (result.rowCount !== 1) {
        throw new Error('Party not found!');
    }

    if (result.rows[0].created_by !== user.id) {
        throw new Error('Only the party owner may perform this action.');
    }
}

async function getNextQueueOrder(client: { query: (query: string, params?: any[]) => Promise<any> }, partyId: string): Promise<number> {
    const result = await client.query(
        `SELECT COALESCE(MAX(queue_order), 0) AS max_order
         FROM tracks
         WHERE party_id = $1`,
        [partyId],
    );

    return Number(result.rows[0].max_order || 0) + 1;
}

async function getTrackRow(client: { query: (query: string, params?: any[]) => Promise<any> }, partyId: string, trackKey: string) {
    const result = await client.query(
        `SELECT track_key, provider, provider_id, added_at, played_at, is_fallback, vote_count, queue_order
         FROM tracks
         WHERE party_id = $1 AND track_key = $2
         FOR UPDATE`,
        [partyId, trackKey],
    );

    return result.rowCount ? result.rows[0] : null;
}

export async function setTrackVote(partyId: string, user: SessionUser, ref: TrackReference, vote: boolean) {
    const client = await pool.connect();
    const trackKey = trackKeyFromRef(ref);

    try {
        await client.query('BEGIN');
        const partyResult = await client.query(
            `SELECT id
             FROM parties
             WHERE id = $1
             FOR UPDATE`,
            [partyId],
        );
        if (partyResult.rowCount !== 1) {
            throw new Error('Party not found!');
        }

        const currentVoteResult = await client.query(
            `SELECT enabled
             FROM votes
             WHERE party_id = $1 AND track_key = $2 AND user_id = $3
             FOR UPDATE`,
            [partyId, trackKey, user.id],
        );
        const currentVote = currentVoteResult.rowCount ? Boolean(currentVoteResult.rows[0].enabled) : null;
        if (currentVote === vote) {
            await client.query('COMMIT');
            return;
        }

        let trackRow = await getTrackRow(client, partyId, trackKey);
        if (!trackRow && !vote) {
            await client.query(
                `INSERT INTO votes (party_id, track_key, user_id, enabled)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (party_id, track_key, user_id) DO UPDATE SET
                     enabled = EXCLUDED.enabled`,
                [partyId, trackKey, user.id, false],
            );
            await client.query('COMMIT');
            return;
        }

        if (!trackRow) {
            const queueOrder = await getNextQueueOrder(client, partyId);
            await client.query(
                `INSERT INTO tracks (party_id, track_key, provider, provider_id, queue_order, vote_count, is_fallback)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [partyId, trackKey, ref.provider, ref.id, queueOrder, 0, false],
            );
            trackRow = await getTrackRow(client, partyId, trackKey);
        }

        const currentCount = Number(trackRow.vote_count || 0);
        const nextCount = vote ? currentCount + 1 : Math.max(0, currentCount - 1);

        await client.query(
            `INSERT INTO votes (party_id, track_key, user_id, enabled)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (party_id, track_key, user_id) DO UPDATE SET
                 enabled = EXCLUDED.enabled`,
            [partyId, trackKey, user.id, vote],
        );

        if (nextCount <= 0) {
            await client.query(
                `DELETE FROM tracks
                 WHERE party_id = $1 AND track_key = $2`,
                [partyId, trackKey],
            );
            await client.query(
                `DELETE FROM votes
                 WHERE party_id = $1 AND track_key = $2`,
                [partyId, trackKey],
            );
        } else {
            await client.query(
                `UPDATE tracks
                 SET vote_count = $3
                 WHERE party_id = $1 AND track_key = $2`,
                [partyId, trackKey, nextCount],
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function removeTrack(partyId: string, user: SessionUser, ref: TrackReference, moveToHistory: boolean) {
    const client = await pool.connect();
    const trackKey = trackKeyFromRef(ref);

    try {
        await client.query('BEGIN');
        await requirePartyOwner(client, partyId, user);

        const trackRow = await getTrackRow(client, partyId, trackKey);
        if (!trackRow) {
            await client.query('COMMIT');
            return;
        }

        if (moveToHistory) {
            await client.query(
                `UPDATE tracks
                 SET played_at = now(),
                     vote_count = 0
                 WHERE party_id = $1 AND track_key = $2`,
                [partyId, trackKey],
            );
        } else {
            await client.query(
                `DELETE FROM tracks
                 WHERE party_id = $1 AND track_key = $2`,
                [partyId, trackKey],
            );
            await client.query(
                `DELETE FROM votes
                 WHERE party_id = $1 AND track_key = $2`,
                [partyId, trackKey],
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function pinTrack(partyId: string, user: SessionUser, ref: TrackReference) {
    const client = await pool.connect();
    const trackKey = trackKeyFromRef(ref);

    try {
        await client.query('BEGIN');
        await requirePartyOwner(client, partyId, user);

        const trackRow = await getTrackRow(client, partyId, trackKey);
        if (!trackRow) {
            await client.query('COMMIT');
            return;
        }

        const result = await client.query(
            `SELECT COALESCE(MIN(queue_order), 0) AS min_order
             FROM tracks
             WHERE party_id = $1`,
            [partyId],
        );
        const minOrder = Number(result.rows[0].min_order || 0);

        await client.query(
            `UPDATE tracks
             SET queue_order = $3
             WHERE party_id = $1 AND track_key = $2`,
            [partyId, trackKey, minOrder - 1],
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function markTrackPlayed(partyId: string, user: SessionUser, ref: TrackReference) {
    const client = await pool.connect();
    const trackKey = trackKeyFromRef(ref);

    try {
        await client.query('BEGIN');
        await requirePartyOwner(client, partyId, user);
        await client.query(
            `UPDATE tracks
             SET played_at = now()
             WHERE party_id = $1 AND track_key = $2`,
            [partyId, trackKey],
        );
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function flushQueue(partyId: string, user: SessionUser) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await requirePartyOwner(client, partyId, user);
        const result = await client.query(
            `SELECT track_key
             FROM tracks
             WHERE party_id = $1 AND played_at IS NULL`,
            [partyId],
        );
        const trackKeys = result.rows.map((row: any) => row.track_key);
        if (trackKeys.length) {
            await client.query(
                `DELETE FROM tracks
                 WHERE party_id = $1 AND played_at IS NULL`,
                [partyId],
            );
            await client.query(
                `DELETE FROM votes
                 WHERE party_id = $1 AND track_key = ANY($2::text[])`,
                [partyId, trackKeys],
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function updatePlaybackState(partyId: string, user: SessionUser, playback: Record<string, any>) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await requirePartyOwner(client, partyId, user);
        const result = await client.query(
            `SELECT playback
             FROM parties
             WHERE id = $1
             FOR UPDATE`,
            [partyId],
        );
        if (result.rowCount !== 1) {
            throw new Error('Party not found!');
        }

        const currentPlayback = result.rows[0].playback || {};
        const mergedPlayback = {
            ...currentPlayback,
            ...playback,
        };
        if (mergedPlayback.last_change == null) {
            mergedPlayback.last_change = Date.now();
        }

        await client.query(
            `UPDATE parties
             SET playback = $2
             WHERE id = $1`,
            [partyId, mergedPlayback],
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
