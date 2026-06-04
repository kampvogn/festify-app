import { eventChannel, Channel, Task } from 'redux-saga';
import {
    all,
    apply,
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
import { Playback, State, Track } from '../state';
import Raven from '../util/raven';
import { takeEveryWithState } from '../util/saga';
import { fetchWithAccessToken, requireAccessToken } from '../util/spotify-auth';

function attachToEvents<T>(player: Spotify.SpotifyPlayer, names: string | string[]) {
    return eventChannel<T>((put) => {
        const listener = (detail: T) => {
            if (detail) {
                put(detail);
            }
        };

        if (!(names instanceof Array)) {
            names = [names];
        }

        return names.reduce(
            (prev, ev) => {
                player.on(ev as any, listener as any);

                return () => {
                    player.removeListener(ev as any, listener as any);
                    prev();
                };
            },
            () => {},
        );
    });
}

function* playTrack(id: string, deviceId: string, positionMs: number = 0) {
    yield put(play(id, positionMs || 0));
    console.log('[playTrack] id:', id, 'deviceId:', deviceId, 'pos:', positionMs);

    const headers = { 'Content-Type': 'application/json' };
    const trackBody = JSON.stringify({
        uris: [`spotify:track:${id}`],
        position_ms: Math.floor(positionMs),
    });
    const playUri = `/me/player/play?device_id=${deviceId}`;

    let resp: Response = yield fetchWithAccessToken(playUri, {
        method: 'put',
        headers,
        body: trackBody,
    });
    console.log('[playTrack] first attempt status:', resp.status);

    if (resp.status === 404) {
        // SDK device went inactive after track end — transfer playback back and retry
        yield fetchWithAccessToken('/me/player', {
            method: 'put',
            headers,
            body: JSON.stringify({ device_ids: [deviceId], play: false }),
        });
        yield new Promise(res => setTimeout(res, 500));
        resp = yield fetchWithAccessToken(playUri, {
            method: 'put',
            headers,
            body: trackBody,
        });
        console.log('[playTrack] retry status:', resp.status);
    }

    if (!resp.ok) {
        console.error('Spotify play failed:', resp.status, yield resp.text());
    }
}

function* handlePlaybackStateChange(
    _: any,
    oldPlayback: Playback | {} | null,
    newPlayback: Playback | null,
    player: Spotify.SpotifyPlayer,
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
            const stateBeforePause: Spotify.PlaybackState | null = yield player.getCurrentState();
            if (stateBeforePause) {
                yield player.pause();
            }
        }

        yield put(togglePlaybackFinish());
        return;
    }

    const currentTrack: Track | null = yield select(currentTrackSelector);
    const spotifyState: Spotify.PlaybackState | null = yield player.getCurrentState();

    if (!currentTrack) {
        return;
    }

    if (spotifyState && spotifyState.track_window.current_track.id === currentTrack.reference.id) {
        if (spotifyState.paused) {
            yield player.resume();
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
            call(playTrack, currentTrack.reference.id, selectedDeviceId || deviceId, position),
            call(markTrackAsPlayed, partyId, currentTrack.reference),
        ]);
    }

    yield put(togglePlaybackFinish());
}

// Returns a saga handler that closes over tracking state for track-end detection.
// Uses lastNonZeroPos (not the raw previous position) so intermediate SDK events
// with position: 0 don't reset the "was playing" signal before the real end event.
function createSpotifyPlaybackChangeHandler() {
    let lastNonZeroPos = 0;
    let lastSeenTrackId: string | null = null;

    return function* handleSpotifyPlaybackChange(spotifyPlayback: Spotify.PlaybackState): any {
        const trackId = spotifyPlayback.track_window.current_track.id;
        const { position, paused } = spotifyPlayback;

        // Capture and update tracking state synchronously before any yield.
        const prevNonZeroPos = lastNonZeroPos;
        const prevTrackId = lastSeenTrackId;

        if (trackId !== lastSeenTrackId) {
            // New track — reset
            lastSeenTrackId = trackId;
            lastNonZeroPos = position > 0 ? position : 0;
        } else if (position > 0) {
            lastNonZeroPos = position;
        }

        console.log('[sdk]', { pos: position, paused, trackId, prevNonZeroPos, prevTrackId, dur: spotifyPlayback.duration });

        // Natural track end: paused at 0, same track, but we previously saw it at a real position.
        // Checked before the duration === 0 guard because the end event may report duration: 0.
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
        if (spotifyPlayback.duration === 0) return;

        const newStatus: Partial<Playback> = {
            last_position_ms: position,
        };

        if (localPlayback.playing !== !paused) {
            // Skip intermediate SDK loading states (paused at position 0) to avoid false pauses.
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
    player: Spotify.SpotifyPlayer,
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
            call(playTrack, newTrack.reference.id, selectedDeviceId || deviceId),
        ]);
    } else {
        const stateBeforeQueuePause: Spotify.PlaybackState | null = yield player.getCurrentState();
        if (stateBeforeQueuePause) {
            yield player.pause();
        }
    }
}

function* handlePlaybackError(error: Spotify.Error) {
    yield put(showToast(error.message));
    console.error('Spotify error:', error);

    Raven.captureException(error.message);
}

// Polling fallback for external Spotify Connect devices.
// The Web Playback SDK only fires player_state_changed when the browser tab
// itself is the active Spotify device. When an external device is selected
// (phone, desktop app, speaker), the SDK stays idle. We poll /me/player
// every 5 seconds: detect track end and keep last_position_ms in sync so
// the progress bar updates for all party guests.
//
// Wall-clock fallback: if Spotify's progress_ms is stuck at 0 (device in
// an odd state), we advance once elapsed wall time >= track duration + 8s.
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

        // Reset wall clock when track changes
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

            // Primary: Spotify reports progress near/at end
            const isAtEnd = spotifyDuration > 0 && spotifyState.progress_ms != null &&
                spotifyState.progress_ms >= spotifyDuration - 1000;

            // Fallback: wall clock says track should have ended (+ 8s grace period)
            const wallElapsed = Date.now() - wallClockStart;
            const isOverdue = spotifyDuration > 0 && wallElapsed >= spotifyDuration + 8000;

            const trackChanged = spotifyTrackId != null && spotifyTrackId !== currentTrack.reference.id;

            if (isOverdue && !isAtEnd) {
                console.log('[poll] wall-clock overdue by', wallElapsed - spotifyDuration, 'ms, progress stuck at', spotifyState.progress_ms);
            }

            // Keep last_position_ms + last_change in sync so the setInterval interpolation
            // in party-track renders smoothly between polls (position + (now - last_change))
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
    let player: Spotify.SpotifyPlayer = null!;

    while (true) {
        try {
            yield take(BECOME_PLAYBACK_MASTER);
            console.log('[player] BECOME_PLAYBACK_MASTER received');

            if (!(yield select((state: State) => state.player.sdkReady))) {
                console.log('[player] waiting for SDK init');
                yield take(SPOTIFY_SDK_INIT_FINISH);
            }
            console.log('[player] SDK ready, creating player');

            player = new Spotify.Player({
                name: 'Festify 🎉',
                getOAuthToken: (cb) => requireAccessToken().then(cb),
                volume: 1,
            });

            const playerErrors: Channel<Spotify.Error> = yield call(attachToEvents, player, [
                'initialization_error',
                'authentication_error',
                'account_error',
                'playback_error',
            ]);

            const playerReady: Channel<Spotify.WebPlaybackInstance> = yield call(
                attachToEvents,
                player,
                'ready',
            );
            const playbackStateChanges: Channel<Spotify.PlaybackState> = yield call(
                attachToEvents,
                player,
                'player_state_changed',
            );

            const connectSuccess: boolean = yield apply(player, player.connect);
            console.log('[player] connect result:', connectSuccess);

            if (!connectSuccess) {
                const error = yield take(playerErrors);
                yield put(playerError(error));
                yield put(
                    updatePlaybackState({
                        master_id: null,
                        playing: false,
                    }),
                );
            }

            const { device_id }: Spotify.WebPlaybackInstance = yield take(playerReady);
            console.log('[player] ready, device_id:', device_id);
            // Diagnostic: raw listener bypasses eventChannel to confirm SDK fires events at all
            player.on('player_state_changed' as any, (state: Spotify.PlaybackState | null) => {
                console.log('[sdk-raw]', state ? { pos: state.position, paused: state.paused, track: state.track_window.current_track.id } : null);
            });
            yield put(playerInitFinish(device_id));

            yield* handlePlaybackStateChange(
                null,
                {},
                yield select(playbackSelector),
                player,
                device_id,
                partyId,
            );
            console.log('[player] initial sync done');

            const queueChangeManager: Task = yield takeEveryWithState(
                UPDATE_TRACKS,
                currentTrackSelector,
                handleQueueChange,
                player,
                device_id,
                partyId,
            );
            const playbackStateUpdateManager: Task = yield takeEveryWithState(
                UPDATE_PLAYBACK_STATE,
                playbackSelector,
                handlePlaybackStateChange,
                player,
                device_id,
                partyId,
            );
            const spotifyPlaybackChangeManager: Task = yield takeEvery(
                playbackStateChanges,
                createSpotifyPlaybackChangeHandler(),
            );
            console.log('[player] SDK event listener active');

            // Diagnostic: log current SDK state right after setup
            const initialSdkState: Spotify.PlaybackState | null = yield apply(player, player.getCurrentState);
            console.log('[player] initial SDK state:', initialSdkState ? { track: initialSdkState.track_window.current_track.id, paused: initialSdkState.paused, pos: initialSdkState.position } : null);

            yield takeEvery(playerErrors, handlePlaybackError);

            const pollTask: Task = yield fork(pollForTrackEnd, partyId);

            yield take(RESIGN_PLAYBACK_MASTER);

            yield apply(player, player.disconnect);
            yield cancel(
                queueChangeManager,
                playbackStateUpdateManager,
                spotifyPlaybackChangeManager,
                pollTask,
            );
        } finally {
            if (player && (yield cancelled())) {
                yield apply(player, player.disconnect);
                break;
            }
        }
    }
}

export default manageLocalPlayer;
