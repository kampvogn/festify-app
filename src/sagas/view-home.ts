import { push } from '@festify/redux-little-router';
import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';

import { showToast } from '../actions';
import { currentAuthUser } from '../util/auth';
import { backendFunctions, BackendUser } from '../util/backend-functions';
import { fetchWithAccessToken } from '../util/spotify-auth';
import { NOTIFY_AUTH_STATUS_KNOWN } from '../actions/auth';
import {
    createNewParty,
    createPartyFail,
    joinPartyFail,
    joinPartyStart,
    resolveShortId,
    CREATE_PARTY_START,
    JOIN_PARTY_START,
} from '../actions/party-data';
import {
    endPartyStart,
    renamePartyStart,
    setMyParties,
    setMyPartiesLoading,
    END_PARTY_START,
    RENAME_PARTY_START,
} from '../actions/view-home';
import { Views } from '../routing';
import { PartySettings, State } from '../state';

function* loadMyParties() {
    yield put(setMyPartiesLoading(true));
    try {
        const { data } = yield call(backendFunctions.getMyParties);
        yield put(setMyParties(data || []));
    } catch {
        yield put(setMyParties([]));
    }
}

function* createParty() {
    const { player, homeView }: State = yield select();

    const backendUser = currentAuthUser() as BackendUser | null;
    if (!backendUser || backendUser.isAnonymous) {
        const e = new Error('Missing Spotify user');
        yield put(createPartyFail(e));
        yield put(showToast('Please log in with Spotify again before hosting a party.', 10000));
        return;
    }

    const userDisplayName = backendUser.displayName || backendUser.email || backendUser.uid;
    const hasPremium = Boolean(backendUser.spotifyIsPremium);

    let userCountry = 'US';
    try {
        const resp: Response = yield call(fetchWithAccessToken, '/me');
        if (resp.ok) {
            const spotifyUser: SpotifyApi.CurrentUsersProfileResponse = yield resp.json();
            if (spotifyUser.country) {
                userCountry = spotifyUser.country;
            }
        }
    } catch {
        // Non-fatal: fall back to 'US' market
    }

    if (!hasPremium) {
        const e = new Error('To create parties and play music on Festify, you need a Spotify Premium account.');
        yield put(createPartyFail(e));
        yield put(showToast(e.message, 10000));
        return;
    }

    const partyName = homeView.createPartyName.trim() || null;

    let partyId: string;
    try {
        partyId = yield call(
            createNewParty,
            userDisplayName,
            player.instanceId,
            userCountry,
            PartySettings.defaultSettings(),
            partyName,
        );
    } catch (err) {
        yield put(createPartyFail(err));
        return;
    }

    yield put(push(`/party/${partyId}`));
}

function* joinParty(ac: ReturnType<typeof joinPartyStart>) {
    const { homeView }: State = yield select();

    if (!homeView.partyIdValid) {
        yield put(joinPartyFail(new Error('Party ID is invalid!')));
        return;
    }

    const longId = yield call(resolveShortId, homeView.partyId);

    if (!longId) {
        yield put(joinPartyFail(new Error('Party not found!')));
        return;
    }

    yield put(push(`/party/${longId}`));
}

function* endParty(ac: ReturnType<typeof endPartyStart>) {
    try {
        yield call(backendFunctions.deleteParty, ac.payload);
        yield call(loadMyParties);
    } catch (err) {
        yield put(showToast('Could not end party: ' + err.message, 6000));
    }
}

function* renameParty(ac: ReturnType<typeof renamePartyStart>) {
    const { partyId, name } = ac.payload;
    try {
        yield call(backendFunctions.renameParty, partyId, name);
        const { homeView }: State = yield select();
        const updated = (homeView.myParties || []).map(p =>
            p.id === partyId ? { ...p, name } : p,
        );
        yield put(setMyParties(updated));
    } catch (err) {
        yield put(showToast('Could not rename party: ' + err.message, 6000));
    }
}

function* onAuthStatusKnown() {
    const { router }: State = yield select();

    if ((router.result || { view: Views.Home }).view !== Views.Home) {
        return;
    }

    const backendUser = currentAuthUser() as BackendUser | null;
    if (!backendUser || backendUser.isAnonymous) {
        return;
    }

    if (!backendUser.spotifyIsPremium) {
        yield put(
            showToast(
                "To create parties and play music on Festify, you need to have a 'Spotify Premium' account. Please login again using a premium account if you want to host parties.",
                10000,
            ),
        );
        return;
    }

    yield call(loadMyParties);
}

export default function*() {
    yield takeLatest(NOTIFY_AUTH_STATUS_KNOWN, onAuthStatusKnown);
    yield takeLatest(CREATE_PARTY_START, createParty);
    yield takeLatest(JOIN_PARTY_START, joinParty);
    yield takeEvery(END_PARTY_START, endParty);
    yield takeEvery(RENAME_PARTY_START, renameParty);
}
