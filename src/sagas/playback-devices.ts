import { OPEN_PARTY_FINISH } from '../actions/party-data';
import {
    loadPlaybackDevicesFail,
    loadPlaybackDevicesFinish,
    loadPlaybackDevicesStart,
    transferPlaybackDeviceFail,
    transferPlaybackDeviceFinish,
    LOAD_PLAYBACK_DEVICES_START,
    PLAYER_INIT_FINISH,
    TRANSFER_PLAYBACK_DEVICE_START,
} from '../actions/playback-spotify';
import { hasConnectedSpotifyAccountSelector } from '../selectors/users';
import { isPartyOwnerSelector } from '../selectors/party';
import { State } from '../state';
import { fetchWithAccessToken } from '../util/spotify-auth';
import { call, put, select, takeEvery } from 'redux-saga/effects';

function* refreshPlaybackDevices() {
    try {
        const response: Response = yield call(fetchWithAccessToken, '/me/player/devices');
        if (!response.ok) {
            const body = yield response.text();
            throw new Error(body || `Failed to load playback devices (${response.status})`);
        }

        const data: SpotifyApi.UserDevicesResponse = yield response.json();
        yield put(loadPlaybackDevicesFinish(data.devices || []));
    } catch (err) {
        yield put(loadPlaybackDevicesFail(err as Error));
    }
}

function* transferPlaybackDevice() {
    const state: State = yield select();
    const deviceId = state.player.selectedDeviceId;

    if (!deviceId) {
        yield put(transferPlaybackDeviceFail(new Error('Select a Spotify device first.')));
        return;
    }

    try {
        const response: Response = yield call(fetchWithAccessToken, '/me/player', {
            method: 'put',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });

        if (!response.ok) {
            const body = yield response.text();
            throw new Error(body || `Failed to transfer playback (${response.status})`);
        }

        yield put(transferPlaybackDeviceFinish());
        yield put(loadPlaybackDevicesStart());
    } catch (err) {
        yield put(transferPlaybackDeviceFail(err as Error));
    }
}

function* maybeLoadDevices() {
    const state: State = yield select();
    if (!isPartyOwnerSelector(state) || !hasConnectedSpotifyAccountSelector(state)) {
        return;
    }

    yield put(loadPlaybackDevicesStart());
}

export default function*() {
    yield takeEvery([OPEN_PARTY_FINISH, PLAYER_INIT_FINISH], maybeLoadDevices);
    yield takeEvery(LOAD_PLAYBACK_DEVICES_START, refreshPlaybackDevices);
    yield takeEvery(TRANSFER_PLAYBACK_DEVICE_START, transferPlaybackDevice);
}
