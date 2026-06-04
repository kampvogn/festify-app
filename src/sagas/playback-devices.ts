import { OPEN_PARTY_FINISH } from '../actions/party-data';
import {
    loadPlaybackDevicesFail,
    loadPlaybackDevicesFinish,
    loadPlaybackDevicesStart,
    transferPlaybackDeviceFail,
    transferPlaybackDeviceFinish,
    LOAD_PLAYBACK_DEVICES_START,
    PLAYER_INIT_FINISH,
    SET_VOLUME,
    TRANSFER_PLAYBACK_DEVICE_START,
} from '../actions/playback-spotify';
import { hasConnectedSpotifyAccountSelector } from '../selectors/users';
import { isPartyOwnerSelector } from '../selectors/party';
import { PlayerDevice, State } from '../state';
import { getProvider } from '../util/provider-registry';
import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';

function* refreshPlaybackDevices() {
    try {
        const provider = getProvider('spotify');
        const devices: PlayerDevice[] = yield call([provider, 'getDevices']);
        yield put(loadPlaybackDevicesFinish(devices));
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
        const provider = getProvider('spotify');
        yield call([provider, 'transferPlayback'], deviceId);
        yield put(transferPlaybackDeviceFinish());
        yield put(loadPlaybackDevicesStart());
    } catch (err) {
        yield put(transferPlaybackDeviceFail(err as Error));
    }
}

function* applyVolume(action: ReturnType<typeof import('../actions/playback-spotify').setVolume>) {
    try {
        const provider = getProvider('spotify');
        yield call([provider, 'setVolume'], action.payload);
    } catch (err) {
        console.warn('Failed to set volume:', err);
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
    yield takeLatest(SET_VOLUME, applyVolume);
}
