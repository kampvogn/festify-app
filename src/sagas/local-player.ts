import { eventChannel, Channel, Task } from 'redux-saga';
import {
    all,
    call,
    cancel,
    cancelled,
    fork,
    put,
    select,
    take,
    takeEvery,
} from 'redux-saga/effects';

import { showToast } from '../actions';
import {
    updatePlaybackState,
    BECOME_PLAYBACK_MASTER,
    RESIGN_PLAYBACK_MASTER,
    UPDATE_PLAYBACK_STATE,
    UPDATE_TRACKS,
} from '../actions/party-data';
import {
    play,
    playerError,
    playerInitFinish,
    setPlayerCompatibility,
    togglePlaybackFinish,
    PLAY,
    SPOTIFY_SDK_INIT_FINISH,
    PAUSE,
} from '../actions/playback-spotify';
import { markTrackAsPlayed, removeTrackAction } from '../actions/queue';
import { playbackSelector } from '../selectors/party';
import { currentTrackSelector, tracksEqual } from '../selectors/track';
import { Playback, State, Track, TrackReference } from '../state';
import { WebPlayerHandle, WebPlaybackState } from '../util/music-provider';
import Raven from '../util/raven';
import { takeEveryWithState } from '../util/saga';
import { fetchWithAccessToken } from '../util/spotify-auth';
import { getProvider } from '../util/provider-registry';

function* playTrack(ref: TrackReference, deviceId: string, positionMs: number = 0) {
    yield put(play(ref.id, positionMs || 0));
    console.log('[playTrack] ref:', ref, 'deviceId:', deviceId, 'pos:', positionMs);
    const provider = getProvider(ref.provider);
    yield call([provider, 'play'], deviceId, ref.id, positionMs || 0);
}

function* handlePlaybackStateChange(
    _: any,
    oldPlayback: Playback | {} | null,
    newPlayback: Playback | null,
    handle: WebPlayerHandle,
    deviceId: string,
    partyId: string,
) {
    if (!oldPlayback || !newPlayback) {
        throw new Error('Wat');
    }

    const oldPlaying = 'playing' in oldPlayback ? (oldPlayback as any).playing : '(none)';
    console.log('[hpsc] oldPlaying:', oldPlaying, 'newPlaying:', newPlayback.playing);

    if ('playing' in oldPlayback && oldPlayback.playing === newPlayback.playing) {
        console.log('[hpsc] playing unchanged, returning');
        return;
    }

    if (!newPlayback.playing) {
        if ('playing' in oldPlayback && oldPlayback.playing) {
            const stateBeforePause: WebPlaybackState | null = yield call([handle, 'getCurrentState']);
            if (stateBeforePause) {
                yield call([handle, 'pause']);
            }
        }

        yield put(togglePlaybackFinish());
        return;
    }

    const currentTrack: Track | null = yield select(currentTrackSelector);
    const webState: WebPlaybackState | null = yield call([handle, 'getCurrentState']);

    if (!currentTrack) {
        return;
    }

    if (webState && webState.trackId === currentTrack.reference.id) {
        if (webState.paused) {
            yield call([handle, 'resume']);
        }
    } else {
        const playing = 'playing' in oldPlayback ? oldPlayback.playing : false;
        const position = newPlayback.last_position_ms
            ? newPlayback.last_position_ms +
              (playing !== false ? Date.now() - newPlayback.last_change : 0)
            : 0;
        const selectedDeviceId: string | null = yield select((state: State) =>
            state.player.selectedDeviceId,
        );

        yield all([
            call(playTrack, currentTrack.reference, selectedDeviceId || deviceId, position),
            call(markTrackAsPlayed, partyId, currentTrack.reference),
        ]);
    }

    yield put(togglePlaybackFinish());
}

function createPlaybackChangeHandler() {
    let lastNonZeroPos = 0;
    let lastSeenTrackId: string | null = null;

    return function* handlePlaybackChange(state: WebPlaybackState | null): any {
        if (!state) return;
        const { paused, position, duration, trackId } = state;

        const prevNonZeroPos = lastNonZeroPos;
        const prevTrackId = lastSeenTrackId;

        if (trackId !== lastSeenTrackId) {
            lastSeenTrackId = trackId;
            lastNonZeroPos = position > 0 ? position : 0;
        } else if (position > 0) {
            lastNonZeroPos = position;
        }

        console.log('[sdk]', { pos: position, paused, trackId, prevNonZeroPos, prevTrackId, dur: duration });

        if (paused && position === 0 && trackId === prevTrackId && prevNonZeroPos > 0) {
            console.log('[sdk] → track end, advancing queue');
            lastNonZeroPos = 0;
            const localPlayback: Playback | null = yield select(playbackSelector);
            if (localPlayback) {
                const currentTrack: Track | null = yield select(currentTrackSelector);
                if (currentTrack) {
                    yield put(removeTrackAction(currentTrack.reference, true));
                    yield put(updatePlaybackState({ playing: true }));
                }
            }
            return;
        }

        const localPlayback: Playback | null = yield select(playbackSelector);
        if (!localPlayback) return;
        if (duration === 0) return;

        const newStatus: Partial<Playback> = {
            last_position_ms: position,
        };

        if (localPlayback.playing !== !paused) {
            const isLoadingState = position === 0 && paused;
            if (!isLoadingState) {
                newStatus.playing = !paused;
            }
        }

        yield put(updatePlaybackState(newStatus));
    };
}

function* handleQueueChange(
    action,
    oldTrack: Track | null,
    newTrack: Track | null,
    handle: WebPlayerHandle,
    deviceId: string,
    partyId: string,
) {
    console.log('[queue]', { old: oldTrack ? oldTrack.reference.id : null, new: newTrack ? newTrack.reference.id : null });
    if (tracksEqual(oldTrack, newTrack)) {
        return;
    }

    const playbackState: Playback | null = yield select(playbackSelector);

    if (!oldTrack && !newTrack) {
        return;
    }

    if (!playbackState!.playing) {
        if (!oldTrack && newTrack) {
            yield put(updatePlaybackState({ playing: true }));
        }
        return;
    }

    if (newTrack) {
        const selectedDeviceId: string | null = yield select((state: State) =>
            state.player.selectedDeviceId,
        );
        yield put(updatePlaybackState({ last_position_ms: 0 }));
        yield all([
            call(markTrackAsPlayed, partyId, newTrack.reference),
            call(playTrack, newTrack.reference, selectedDeviceId || deviceId),
        ]);
    } else {
        const stateBeforeQueuePause: WebPlaybackState | null = yield call([handle, 'getCurrentState']);
        if (stateBeforeQueuePause) {
            yield call([handle, 'pause']);
        }
    }
}

function* handlePlaybackError(error: Error) {
    yield put(showToast(error.message));
    console.error('Playback error:', error);
    Raven.captureException(error);
}

// Polling fallback for external Spotify Connect devices (Spotify-specific).
// The Web Playback SDK only fires player_state_changed when the browser tab
// itself is the active Spotify device. When an external device is selected
// (phone, desktop app, speaker), the SDK stays idle. We poll /me/player
// every 5 seconds to detect track end and keep last_position_ms in sync.
function* pollForTrackEnd(partyId: string) {
    console.log('[poll] saga started');
    let wallClockTrackId: string | null = null;
    let wallClockStart: number = 0;

    while (true) {
        yield new Promise(res => setTimeout(res, 5000));

        const playback: Playback | null = yield select(playbackSelector);
        if (!playback || !playback.playing) continue;

        const currentTrack: Track | null = yield select(currentTrackSelector);
        if (!currentTrack) continue;

        if (currentTrack.reference.id !== wallClockTrackId) {
            wallClockTrackId = currentTrack.reference.id;
            wallClockStart = Date.now();
        }

        try {
            const resp: Response = yield fetchWithAccessToken('/me/player');

            if (resp.status === 204) {
                const t: Track | null = yield select(currentTrackSelector);
                if (t && tracksEqual(t, currentTrack)) {
                    console.log('[poll] 204, advancing queue');
                    yield put(removeTrackAction(currentTrack.reference, true));
                    yield put(updatePlaybackState({ playing: true }));
                }
                continue;
            }

            if (!resp.ok) continue;

            const spotifyState: any = yield call(() => resp.json());
            const spotifyTrackId: string | null = spotifyState.item ? spotifyState.item.id : null;
            const spotifyDuration: number = spotifyState.item ? (spotifyState.item.duration_ms || 0) : 0;

            const isAtEnd = spotifyDuration > 0 && spotifyState.progress_ms != null &&
                spotifyState.progress_ms >= spotifyDuration - 1000;

            const wallElapsed = Date.now() - wallClockStart;
            const isOverdue = spotifyDuration > 0 && wallElapsed >= spotifyDuration + 8000;

            const trackChanged = spotifyTrackId != null && spotifyTrackId !== currentTrack.reference.id;

            if (isOverdue && !isAtEnd) {
                console.log('[poll] wall-clock overdue by', wallElapsed - spotifyDuration, 'ms, progress stuck at', spotifyState.progress_ms);
            }

            if (spotifyTrackId === currentTrack.reference.id && spotifyState.progress_ms != null) {
                const displayPos = isOverdue ? spotifyDuration : spotifyState.progress_ms;
                yield put(updatePlaybackState({
                    last_position_ms: displayPos,
                    last_change: Date.now(),
                }));
            }

            if (isAtEnd || isOverdue || trackChanged) {
                const t: Track | null = yield select(currentTrackSelector);
                if (t && tracksEqual(t, currentTrack)) {
                    console.log('[poll] advancing queue, atEnd:', isAtEnd, 'overdue:', isOverdue, 'trackChanged:', trackChanged);
                    yield put(removeTrackAction(currentTrack.reference, true));
                    yield put(updatePlaybackState({ playing: true }));
                }
            }
        } catch (err) {
            console.error('[poll] error:', err);
        }
    }
}

export function* manageLocalPlayer(partyId: string) {
    while (true) {
        try {
            yield take(BECOME_PLAYBACK_MASTER);
            console.log('[player] BECOME_PLAYBACK_MASTER received');

            if (!(yield select((state: State) => state.player.sdkReady))) {
                console.log('[player] waiting for SDK init');
                yield take(SPOTIFY_SDK_INIT_FINISH);
            }
            console.log('[player] SDK ready, initializing web player');

            let handle: WebPlayerHandle;
            try {
                handle = yield call([getProvider('spotify'), 'initWebPlayer']);
            } catch (err) {
                yield put(playerError(err as Error));
                yield put(updatePlaybackState({ master_id: null, playing: false }));
                continue;
            }

            console.log('[player] ready, device_id:', handle.deviceId);
            yield put(playerInitFinish(handle.deviceId));

            const playerErrors: Channel<Error> = eventChannel<Error>(
                emit => handle.onError(emit),
            );
            const playbackStateChanges: Channel<WebPlaybackState | null> = eventChannel<WebPlaybackState | null>(
                emit => handle.onStateChange(emit),
            );

            yield* handlePlaybackStateChange(
                null,
                {},
                yield select(playbackSelector),
                handle,
                handle.deviceId,
                partyId,
            );
            console.log('[player] initial sync done');

            const queueChangeManager: Task = yield takeEveryWithState(
                UPDATE_TRACKS,
                currentTrackSelector,
                handleQueueChange,
                handle,
                handle.deviceId,
                partyId,
            );
            const playbackStateUpdateManager: Task = yield takeEveryWithState(
                UPDATE_PLAYBACK_STATE,
                playbackSelector,
                handlePlaybackStateChange,
                handle,
                handle.deviceId,
                partyId,
            );
            const sdkPlaybackChangeManager: Task = yield takeEvery(
                playbackStateChanges,
                createPlaybackChangeHandler(),
            );
            console.log('[player] SDK event listener active');

            const initialState: WebPlaybackState | null = yield call([handle, 'getCurrentState']);
            console.log('[player] initial SDK state:', initialState
                ? { track: initialState.trackId, paused: initialState.paused, pos: initialState.position }
                : null);

            yield takeEvery(playerErrors, handlePlaybackError);

            const pollTask: Task = yield fork(pollForTrackEnd, partyId);

            yield take(RESIGN_PLAYBACK_MASTER);

            handle.disconnect();
            yield cancel(
                queueChangeManager,
                playbackStateUpdateManager,
                sdkPlaybackChangeManager,
                pollTask,
            );
        } finally {
            if (yield cancelled()) {
                break;
            }
        }
    }
}

export default manageLocalPlayer;
