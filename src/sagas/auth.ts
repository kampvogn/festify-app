import { replace, LOCATION_CHANGED } from '@festify/redux-little-router';
import { CallableResult, ExchangeCodeResult, SessionResult } from '../util/backend-functions';
import {
    apply,
    call,
    put,
    select,
    take,
    takeEvery,
    takeLatest,
} from 'redux-saga/effects';

import { CLIENT_ID } from '../../spotify.config';
import {
    checkLoginStatus,
    exchangeCodeFail,
    exchangeCodeStart,
    notifyAuthStatusKnown,
    triggerOAuthLogin as triggerOAuthLoginAction,
    welcomeUser,
    CHECK_LOGIN_STATUS,
    LOGOUT,
    TRIGGER_OAUTH_LOGIN,
} from '../actions/auth';
import { updatePlaybackState } from '../actions/party-data';
import { requireAuth, AuthData, saveSelfHostedSession, signOutAuth } from '../util/auth';
import { backendFunctions } from '../util/backend-functions';
import { fetchWithAccessToken, LOCALSTORAGE_KEY, SCOPES } from '../util/spotify-auth';
import { isPlaybackMasterSelector } from '../selectors/party';

const AUTH_REDIRECT_LOCAL_STORAGE_KEY = 'AuthRedirect';

function spotifyCallbackUrl() {
    return `${window.location.origin}/callback`;
}

function spotifyOAuthUrl() {
    return (
        `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(spotifyCallbackUrl())}&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES.join(' '))}&state=SPOTIFY_AUTH&show_dialog=true`
    );
}

function* checkLogin() {
    yield call(requireAuth);

    if (!localStorage[LOCALSTORAGE_KEY]) {
        yield put(notifyAuthStatusKnown('spotify', null));
        return;
    }

    try {
        const resp = yield call(fetchWithAccessToken, '/me');
        const user = yield resp.json();
        yield put(notifyAuthStatusKnown('spotify', user));
    } catch (err) {
        console.error('Failed to fetch Spotify Login Status.');
    }
}

function* handleSpotifyOAuth() {
    const action = yield take(LOCATION_CHANGED);
    const { code, error, state } = action.payload.query;

    if (state !== 'SPOTIFY_AUTH') {
        return;
    }

    yield put(exchangeCodeStart('spotify'));

    if (error === 'access_denied') {
        yield put(exchangeCodeFail('spotify', new Error('Oops, Spotify denied access.')));
        return;
    }

    yield put(replace(localStorage[AUTH_REDIRECT_LOCAL_STORAGE_KEY] || '/', {}));
    localStorage.removeItem(AUTH_REDIRECT_LOCAL_STORAGE_KEY);

    yield call(requireAuth);

    let resp: CallableResult<ExchangeCodeResult>;
    try {
        resp = yield call(backendFunctions.exchangeCode, { callbackUrl: spotifyCallbackUrl(), code });
    } catch (err) {
        yield put(exchangeCodeFail('spotify', err));
        return;
    }

    const { accessToken, expiresIn } = resp.data;

    const data = new AuthData(accessToken, Date.now() + expiresIn * 1000);
    yield apply(data, data.saveTo, [LOCALSTORAGE_KEY]);

    let sessionData: SessionResult;
    try {
        const result = yield call(backendFunctions.linkSpotifyAccounts, { accessToken });
        sessionData = result.data as SessionResult;
    } catch (err) {
        yield put(exchangeCodeFail('spotify', new Error(`Token exchange failed: ${err.message}.`)));
        return;
    }

    const newUser = yield call(saveSelfHostedSession, sessionData);

    yield* checkLogin();
    yield put(welcomeUser(newUser));
}

function* logout() {
    if (yield select(isPlaybackMasterSelector)) {
        yield put(updatePlaybackState({ master_id: null, playing: false }));
    }

    yield call(AuthData.remove, LOCALSTORAGE_KEY);
    yield call(signOutAuth);
    yield put(checkLoginStatus());
}

function* triggerOAuthLogin(ac: ReturnType<typeof triggerOAuthLoginAction>) {
    if (ac.payload === 'spotify') {
        console.log('Only the swaggiest of developers hacking on Festify will see this 🙌.');
        localStorage[AUTH_REDIRECT_LOCAL_STORAGE_KEY] =
            window.location.pathname + window.location.search + window.location.hash;
        window.location.href = spotifyOAuthUrl();
    } else {
        yield put(exchangeCodeFail(ac.payload, new Error('Only Spotify login is supported.')));
    }
}

export default function*() {
    yield takeEvery(CHECK_LOGIN_STATUS, checkLogin);
    yield takeLatest(LOGOUT, logout);
    yield takeEvery(TRIGGER_OAUTH_LOGIN, triggerOAuthLogin);

    yield* handleSpotifyOAuth();
    yield* checkLogin();
}
