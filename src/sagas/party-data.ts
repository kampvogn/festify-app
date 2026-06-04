import { push, LOCATION_CHANGED } from '@festify/redux-little-router';
import { Channel, END, eventChannel } from 'redux-saga';
import { delay } from 'redux-saga';
import { call, cancel, cancelled, fork, put, select, take, takeEvery } from 'redux-saga/effects';

import { NOTIFY_AUTH_STATUS_KNOWN } from '../actions/auth';
import {
    becomePlaybackMaster,
    cleanupParty,
    openPartyFail,
    openPartyFinish,
    openPartyStart,
    resignPlaybackMaster,
    updateConnectionState,
    updateParty,
    updateTracks,
    updateUserVotes,
    CLEANUP_PARTY,
    OPEN_PARTY_START,
} from '../actions/party-data';
import { isPartyOwnerSelector, partyIdSelector } from '../selectors/party';
import { ConnectionState, Party, State } from '../state';
import { store } from '../store';
import { requireAuth } from '../util/auth';
import { backendConfig } from '../util/backend';
import { backendFunctions } from '../util/backend-functions';

import managePlaybackState from './playback-state';
import manageQueue from './queue';
import { managePartySettings } from './view-party-settings';

type SelfHostedSnapshot = { party: Party; tracks: Record<string, any>; userVotes: Record<string, boolean> };

function* publishSelfHostedSnapshot(snapshot: SelfHostedSnapshot) {
    const state1: State = yield select();
    yield put(updateParty(snapshot.party));
    yield put(updateTracks(snapshot.tracks));
    yield put(updateUserVotes(snapshot.userVotes));
    yield put(updateConnectionState(ConnectionState.Connected));

    const state2: State = yield select();
    if (!isPartyOwnerSelector(state2) || !state1.party.currentParty) {
        return;
    }

    if (
        state1.party.currentParty.playback &&
        state1.party.currentParty.playback.master_id !== state1.player.instanceId &&
        snapshot.party.playback &&
        snapshot.party.playback.master_id === state1.player.instanceId
    ) {
        yield put(becomePlaybackMaster());
    } else if (
        (!state2.party.currentParty ||
            (state1.party.currentParty.playback &&
                state1.party.currentParty.playback.master_id === state1.player.instanceId)) &&
        snapshot.party.playback &&
        snapshot.party.playback.master_id !== state1.player.instanceId
    ) {
        yield put(resignPlaybackMaster());
    }
}

function parseSseEvent(block: string): SelfHostedSnapshot | null {
    const lines = block.split(/\r?\n/);
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^\s+/, '')).join('\n');
    if (!data) {
        return null;
    }

    const parsed = JSON.parse(data);
    if (!parsed || parsed.type !== 'snapshot' || !parsed.snapshot) {
        return null;
    }

    return parsed.snapshot as SelfHostedSnapshot;
}

function createSelfHostedSnapshotChannel(partyId: string) {
    return eventChannel<SelfHostedSnapshot | typeof END>((emitter) => {
        const controller = new AbortController();

        const run = async () => {
            try {
                const response = await fetch(
                    `${backendConfig.apiUrl}/api/parties/${encodeURIComponent(partyId)}/events`,
                    {
                        credentials: 'include',
                        headers: { Accept: 'text/event-stream' },
                        signal: controller.signal,
                    },
                );

                if (!response.ok || !response.body) {
                    const message = await response.text();
                    throw new Error(message || `Self-hosted realtime failed with ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    let separatorIndex = buffer.indexOf('\n\n');
                    while (separatorIndex >= 0) {
                        const rawEvent = buffer.slice(0, separatorIndex).trim();
                        buffer = buffer.slice(separatorIndex + 2);
                        separatorIndex = buffer.indexOf('\n\n');
                        if (!rawEvent || rawEvent.startsWith(':')) {
                            continue;
                        }

                        const snapshot = parseSseEvent(rawEvent);
                        if (snapshot) {
                            emitter(snapshot);
                        }
                    }
                }

                emitter(END);
            } catch (err) {
                if (!controller.signal.aborted) {
                    emitter(END);
                }
            }
        };

        void run();

        return () => {
            controller.abort();
        };
    });
}

function* watchSelfHostedPartyUpdates(partyId: string) {
    while (true) {
        const channel = yield call(createSelfHostedSnapshotChannel, partyId);
        try {
            while (true) {
                const snapshot: SelfHostedSnapshot | typeof END = yield take(channel);
                if (snapshot === END) {
                    break;
                }

                yield* publishSelfHostedSnapshot(snapshot as SelfHostedSnapshot);
            }
        } finally {
            channel.close();
            if (yield cancelled()) {
                return;
            }
        }

        yield put(updateConnectionState(ConnectionState.Disconnected));
        yield delay(2000);
    }
}

function* loadParty() {
    const closeListener = (e: BeforeUnloadEvent) => {
        const { party, player } = store.getState();

        if (
            !party.currentParty ||
            !party.currentParty.playback ||
            !party.currentParty.playback.playing ||
            party.currentParty.playback.master_id !== player.instanceId
        ) {
            return;
        }

        e.returnValue = '😅';
        return '😅';
    };

    while (true) {
        const { payload: id }: ReturnType<typeof openPartyStart> = yield take(OPEN_PARTY_START);

        try {
            yield call(requireAuth);
            const { data: snapshot } = yield call(backendFunctions.getParty, id);
            yield* publishSelfHostedSnapshot(snapshot);
            yield put(openPartyFinish(snapshot.party));
        } catch (err) {
            yield put(openPartyFail(err));
            yield put(push('/'));
            continue;
        }

        const partySettings = yield fork(managePartySettings, id);
        const playbackManager = yield fork(managePlaybackState, id);
        const queueManager = yield fork(manageQueue, id);
        const selfHostedUpdates = yield fork(watchSelfHostedPartyUpdates, id);

        window.onbeforeunload = closeListener;

        yield take(CLEANUP_PARTY);

        yield cancel(partySettings, playbackManager, queueManager, selfHostedUpdates);
    }
}

function* watchRoute() {
    let oldPartyId = '';
    while (true) {
        const action = yield take(LOCATION_CHANGED);

        const partyId = action.payload.params && action.payload.params.partyId;
        if (oldPartyId === partyId) {
            continue;
        }

        if (partyId) {
            yield put(openPartyStart(partyId));
        } else if (oldPartyId) {
            yield put(cleanupParty());
        }

        oldPartyId = partyId || '';
    }
}

export default function*() {
    yield fork(loadParty);
    yield fork(watchRoute);
}
