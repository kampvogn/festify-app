import type { FastifyReply } from 'fastify';

import { pool, listenClient } from './db.js';
import { loadPartySnapshot } from './party-state.js';

interface PartyStreamSubscriber {
    partyId: string;
    userId: string;
    reply: FastifyReply;
}

const NOTIFY_CHANNEL = 'festify_party';
const subscribers = new Map<string, Set<PartyStreamSubscriber>>();

function removeSubscriber(subscriber: PartyStreamSubscriber) {
    const set = subscribers.get(subscriber.partyId);
    if (!set) {
        return;
    }

    set.delete(subscriber);
    if (set.size === 0) {
        subscribers.delete(subscriber.partyId);
    }
}

function writeEvent(reply: FastifyReply, event: string, data: unknown) {
    reply.raw.write('event: ' + event + '\n');
    reply.raw.write('data: ' + JSON.stringify(data) + '\n\n');
}

async function broadcastToLocalSubscribers(partyId: string) {
    const set = subscribers.get(partyId);
    if (!set || set.size === 0) {
        return;
    }

    await Promise.all(Array.from(set).map(async (subscriber) => {
        const snapshot = await loadPartySnapshot(partyId, subscriber.userId);
        if (!snapshot) {
            return;
        }

        try {
            writeEvent(subscriber.reply, 'snapshot', { type: 'snapshot', snapshot });
        } catch (err) {
            removeSubscriber(subscriber);
        }
    }));
}

async function reconnectListenClient() {
    try {
        await listenClient.connect();
        await listenClient.query(`LISTEN "${NOTIFY_CHANNEL}"`);
    } catch (err) {
        setTimeout(() => reconnectListenClient(), 10000);
    }
}

export async function initRealtime(): Promise<void> {
    await listenClient.connect();
    await listenClient.query(`LISTEN "${NOTIFY_CHANNEL}"`);

    listenClient.on('notification', async (msg) => {
        if (msg.channel !== NOTIFY_CHANNEL || !msg.payload) {
            return;
        }

        let partyId: string;
        try {
            ({ partyId } = JSON.parse(msg.payload) as { partyId: string });
        } catch {
            return;
        }

        await broadcastToLocalSubscribers(partyId);
    });

    listenClient.on('error', () => {
        setTimeout(() => reconnectListenClient(), 5000);
    });
}

export function registerPartyStream(partyId: string, userId: string, reply: FastifyReply) {
    const subscriber: PartyStreamSubscriber = { partyId, userId, reply };
    const set = subscribers.get(partyId) || new Set<PartyStreamSubscriber>();
    set.add(subscriber);
    subscribers.set(partyId, set);

    return () => removeSubscriber(subscriber);
}

export async function publishPartySnapshot(partyId: string) {
    await pool.query(`SELECT pg_notify($1, $2)`, [
        NOTIFY_CHANNEL,
        JSON.stringify({ partyId }),
    ]);
}
