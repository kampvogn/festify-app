import isEqual from 'lodash-es/isEqual';
import { call, fork, put, select, take, takeEvery } from 'redux-saga/effects';

import {
    becomePlaybackMaster,
    resignPlaybackMaster,
    updateParty,
    updatePlaybackState,
    BECOME_PLAYBACK_MASTER,
    INSTALL_PLAYBACK_MASTER,
    RESIGN_PLAYBACK_MASTER,
    UPDATE_PARTY,
    UPDATE_PLAYBACK_STATE,
    UPDATE_TRACKS,
} from '../actions/party-data';
import { togglePlaybackFinish, TOGGLE_PLAYBACK_START } from '../actions/playback-spotify';
import { isPartyOwnerSelector, playbackSelector } from '../selectors/party';
import { currentTrackSelector, tracksEqual } from '../selectors/track';
import { Playback, State, Track } from '../state';
import { backendConfig } from '../util/backend';
import { backendFunctions } from '../util/backend-functions';
import { takeEveryWithState } from '../util/saga';

import manageLocalPlayer from './local-player';

function* handleTakeOver() {
    const { party, player }: State = yield select();

    if (party.currentParty!.playback && player.instanceId === party.currentParty!.playback.master_id) {
        return;
    }

    yield put(updatePlaybackState({ master_id: player.instanceId }));
}

function* handlePlayPause() {
    const { party, player }: State = yield select();
    const playback = party.currentParty!.playback || {
        last_change: Date.now(),
        last_position_ms: 0,
        master_id: null,
        playing: false,
        target_playing: null,
    };

    const startingPlayback = !playback.playing;
    yield put(
        updatePlaybackState({
            playing: startingPlayback,
            master_id: startingPlayback ? player.instanceId : (playback.master_id || player.instanceId),
            last_change: Date.now(),
        }),
    );

    if (playback.master_id !== player.instanceId) {
        yield put(togglePlaybackFinish());
    }
}

function* persistPlaybackState(partyId: string) {
    while (true) {
        const oldState: Playback | null = yield select(playbackSelector);
        const { payload }: ReturnType<typeof updatePlaybackState> = yield take(UPDATE_PLAYBACK_STATE);

        if (!(yield select(isPartyOwnerSelector))) {
            continue;
        }

        const isChangingState =
            !oldState ||
            ('playing' in payload && oldState.playing !== payload.playing) ||
            ('last_position_ms' in payload && oldState.last_position_ms !== payload.last_position_ms);
        const update = isChangingState ? { ...payload, last_change: Date.now() } : payload;

        yield call(backendFunctions.updatePlaybackState, { partyId, playback: update });
    }
}

function* handlePartyUpdate(
    action: ReturnType<typeof updateParty> | ReturnType<typeof updatePlaybackState>,
    oldPlayback: Playback | null,
    newPlayback: Playback | null,
) {
    if (!oldPlayback || !newPlayback) {
        return;
    }

    if (oldPlayback.master_id !== newPlayback.master_id) {
        if (newPlayback.master_id === (yield select((state: State) => state.player.instanceId))) {
            yield put(becomePlaybackMaster());
        } else {
            yield put(resignPlaybackMaster());
        }
    }

    oldPlayback = { ...oldPlayback, last_change: newPlayback.last_change };

    if (action.type !== UPDATE_PLAYBACK_STATE && !isEqual(newPlayback, oldPlayback)) {
        yield put(updatePlaybackState(newPlayback));
    }
}

export function* managePlaybackState(partyId: string) {
    yield takeEvery(INSTALL_PLAYBACK_MASTER, handleTakeOver);
    yield takeEvery(TOGGLE_PLAYBACK_START, handlePlayPause);

    yield fork(persistPlaybackState, partyId);
    yield takeEveryWithState([UPDATE_PARTY, UPDATE_PLAYBACK_STATE], playbackSelector, handlePartyUpdate);

    // Clear master_id when page unloads so the next session starts clean
    yield call(() => {
        window.addEventListener('beforeunload', () => {
            const url = `${backendConfig.apiUrl}/api/parties/${encodeURIComponent(partyId)}/playback`;
            fetch(url, {
                method: 'POST',
                credentials: 'include',
                keepalive: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partyId, playback: { master_id: null, playing: false } }),
            });
        }, { once: true });
    });

    yield fork(manageLocalPlayer, partyId);

    yield takeEveryWithState(UPDATE_TRACKS, currentTrackSelector, function*(
        action,
        oldTrack: Track | null,
        newTrack: Track | null,
    ) {
        if (!oldTrack || tracksEqual(oldTrack, newTrack)) {
            return;
        }

        yield put(updatePlaybackState({ last_position_ms: 0 }));
    });
}

export default managePlaybackState;
