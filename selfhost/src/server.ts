import Fastify, { FastifyReply } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { runner } from 'node-pg-migrate';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

import { checkDatabase, pool } from './db.js';
import { createParty, getParty, resolveShortId } from './parties.js';
import { flushQueue, loadPartySnapshot, markTrackPlayed, pinTrack, removeTrack, setTrackVote, updatePlaybackState } from './party-state.js';
import { initRealtime, publishPartySnapshot, registerPartyStream } from './realtime.js';
import { requireSessionUser } from './session.js';
import { createAnonymousSession, upsertSpotifySession } from './auth.js';
import { exchangeCode, getClientToken, refreshToken } from './spotify.js';
import { config } from './config.js';

const app = Fastify({ logger: true });

async function runMigrations() {
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
    await runner({
        databaseUrl: config.databaseUrl,
        dir: migrationsDir,
        direction: 'up',
        migrationsTable: 'pgmigrations',
        log: (msg: string) => app.log.info(msg),
    });
}

function setSseHeaders(reply: FastifyReply) {
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': config.publicOrigin,
        'Access-Control-Allow-Credentials': 'true',
    });
}

function setSessionCookie(reply: FastifyReply, token: string) {
    reply.setCookie('sessionToken', token, {
        httpOnly: true,
        secure: config.publicOrigin.startsWith('https'),
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });
}

app.setErrorHandler((error, request, reply) => {
    const err = error instanceof Error ? error : new Error(String(error));
    request.log.error(err);

    if (err.message === 'Missing bearer token.' || err.message === 'Session user not found.') {
        reply.code(401).send({ error: 'Unauthorized', message: err.message });
        return;
    }

    if (
        err.message === 'A linked Spotify account is required to host parties.' ||
        err.message === 'This Spotify account is not allowed to host parties.' ||
        err.message === 'To create parties and play music on Festify, you need a Spotify Premium account.' ||
        err.message === 'Party not found!' ||
        err.message === 'Only the party owner may perform this action.'
    ) {
        reply.code(403).send({ error: 'Forbidden', message: err.message });
        return;
    }

    reply.code(500).send({ error: 'Internal Server Error', message: err.message });
});

app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', config.publicOrigin);
    reply.header('Access-Control-Allow-Headers', 'content-type, authorization');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Credentials', 'true');

    if (request.method === 'OPTIONS') {
        reply.code(204).send();
    }
});

app.get('/health', async () => {
    await checkDatabase();
    return { ok: true };
});

app.get('/api/health', async () => {
    await checkDatabase();
    return { ok: true };
});

// Debug log relay — browser sends tagged console output here.
// Read with: docker logs -f festify-api 2>&1 | grep BROWSER
app.post('/api/debug/log', async (request) => {
    const body = request.body as { entries?: { level: string; msg: string; ts: number }[] };
    for (const entry of body?.entries ?? []) {
        const elapsed = ((Date.now() - entry.ts) / 1000).toFixed(1);
        process.stderr.write(`[BROWSER/${entry.level.toUpperCase()} +${elapsed}s] ${entry.msg}\n`);
    }
    return { ok: true };
});

app.post('/api/auth/anonymous', async (request, reply) => {
    const result = await createAnonymousSession();
    setSessionCookie(reply, result.sessionToken);
    return result;
});

app.get('/api/auth/me', async (request, reply) => {
    try {
        const user = await requireSessionUser(request);
        return {
            uid: user.id,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoUrl,
            isAnonymous: user.spotifyId === null,
            providerId: user.spotifyId !== null ? 'spotify' : 'anonymous',
            spotifyIsPremium: user.spotifyIsPremium,
        };
    } catch {
        reply.code(401);
        return { error: 'Unauthorized' };
    }
});

app.post('/api/auth/signout', async (request, reply) => {
    reply.clearCookie('sessionToken', { path: '/' });
    return { ok: true };
});

app.get('/api/parties/mine', async (request) => {
    const user = await requireSessionUser(request);
    const result = await pool.query(
        `SELECT id, short_id, name, created_at FROM parties WHERE created_by = $1 ORDER BY created_at DESC`,
        [user.id],
    );
    return result.rows.map(row => ({
        id: row.id,
        short_id: row.short_id,
        name: row.name,
        created_at: new Date(row.created_at).getTime(),
    }));
});

app.patch('/api/parties/:partyId', async (request, reply) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const body = z.object({ name: z.string().min(1).max(100) }).parse(request.body);
    const user = await requireSessionUser(request);
    const result = await pool.query(
        `UPDATE parties SET name = $1, updated_at = now() WHERE id = $2 AND created_by = $3 RETURNING id, name`,
        [body.name, params.partyId, user.id],
    );
    if (result.rowCount === 0) {
        reply.code(403);
        return { error: 'Only the party owner may perform this action.' };
    }
    return result.rows[0];
});

app.delete('/api/parties/:partyId', async (request, reply) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const user = await requireSessionUser(request);
    const result = await pool.query(
        `DELETE FROM parties WHERE id = $1 AND created_by = $2`,
        [params.partyId, user.id],
    );
    if (result.rowCount === 0) {
        reply.code(403);
        return { error: 'Only the party owner may perform this action.' };
    }
    return { ok: true };
});

app.post('/api/parties', async (request) => {
    const user = await requireSessionUser(request);
    return createParty(request.body, user);
});

app.get('/api/parties/resolve/:shortId', async (request) => {
    const params = z.object({ shortId: z.string().min(1) }).parse(request.params);
    return { partyId: await resolveShortId(params.shortId) };
});

app.get('/api/parties/:partyId', async (request, reply) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const user = await requireSessionUser(request);
    const snapshot = await loadPartySnapshot(params.partyId, user.id);
    if (!snapshot) {
        reply.code(404);
        return { error: 'Party not found' };
    }

    return snapshot;
});
app.get('/api/parties/:partyId/events', async (request, reply) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const user = await requireSessionUser(request);
    const snapshot = await loadPartySnapshot(params.partyId, user.id);
    if (!snapshot) {
        reply.code(404);
        return { error: 'Party not found' };
    }

    reply.hijack();
    setSseHeaders(reply);
    reply.raw.write('event: snapshot\n');
    reply.raw.write('data: ' + JSON.stringify({ type: 'snapshot', snapshot }) + '\n\n');

    const unregister = registerPartyStream(params.partyId, user.id, reply);
    const heartbeat = setInterval(() => {
        reply.raw.write(': ping\n\n');
    }, 15000);

    const cleanup = () => {
        clearInterval(heartbeat);
        unregister();
        try {
            reply.raw.end();
        } catch (err) {
            // ignore
        }
    };

    request.raw.on('close', cleanup);
    reply.raw.on('close', cleanup);
});

app.post('/api/spotify/client-token', async () => {
    return getClientToken();
});

app.post('/api/spotify/exchange-code', async (request) => {
    const body = z.object({
        callbackUrl: z.string().url(),
        code: z.string().min(1),
    }).parse(request.body);

    return exchangeCode(body.callbackUrl, body.code);
});

app.post('/api/spotify/refresh-token', async (request) => {
    const body = z.object({
        refreshToken: z.string().min(1),
    }).parse(request.body);

    return refreshToken(body.refreshToken);
});

app.post('/api/spotify/link-account', async (request, reply) => {
    const body = z.object({
        accessToken: z.string().min(1),
    }).parse(request.body);

    const result = await upsertSpotifySession(body.accessToken);
    setSessionCookie(reply, result.sessionToken);
    return result;
});


app.post('/api/parties/:partyId/tracks/vote', async (request) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const body = z.object({
        ref: z.object({ provider: z.string().min(1), id: z.string().min(1) }),
        vote: z.boolean(),
    }).parse(request.body);
    const user = await requireSessionUser(request);
    await setTrackVote(params.partyId, user, body.ref, body.vote);
    void publishPartySnapshot(params.partyId);
    return loadPartySnapshot(params.partyId, user.id);
});

app.post('/api/parties/:partyId/tracks/remove', async (request) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const body = z.object({
        ref: z.object({ provider: z.string().min(1), id: z.string().min(1) }),
        moveToHistory: z.boolean(),
    }).parse(request.body);
    const user = await requireSessionUser(request);
    await removeTrack(params.partyId, user, body.ref, body.moveToHistory);
    void publishPartySnapshot(params.partyId);
    return loadPartySnapshot(params.partyId, user.id);
});

app.post('/api/parties/:partyId/tracks/pin', async (request) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const body = z.object({
        ref: z.object({ provider: z.string().min(1), id: z.string().min(1) }),
    }).parse(request.body);
    const user = await requireSessionUser(request);
    await pinTrack(params.partyId, user, body.ref);
    void publishPartySnapshot(params.partyId);
    return loadPartySnapshot(params.partyId, user.id);
});

app.post('/api/parties/:partyId/tracks/played', async (request) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const body = z.object({
        ref: z.object({ provider: z.string().min(1), id: z.string().min(1) }),
    }).parse(request.body);
    const user = await requireSessionUser(request);
    await markTrackPlayed(params.partyId, user, body.ref);
    void publishPartySnapshot(params.partyId);
    return loadPartySnapshot(params.partyId, user.id);
});

app.post('/api/parties/:partyId/tracks/flush', async (request) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const user = await requireSessionUser(request);
    await flushQueue(params.partyId, user);
    void publishPartySnapshot(params.partyId);
    return loadPartySnapshot(params.partyId, user.id);
});

app.post('/api/parties/:partyId/playback', async (request) => {
    const params = z.object({ partyId: z.string().uuid() }).parse(request.params);
    const body = z.object({ playback: z.record(z.any()) }).parse(request.body);
    const user = await requireSessionUser(request);
    await updatePlaybackState(params.partyId, user, body.playback);
    void publishPartySnapshot(params.partyId);
    return loadPartySnapshot(params.partyId, user.id);
});

async function start() {
    await app.register(fastifyCookie);
    await runMigrations();
    await initRealtime();
    await app.listen({ host: '0.0.0.0', port: config.port });
}

start().catch(err => {
    app.log.error(err);
    process.exit(1);
});
