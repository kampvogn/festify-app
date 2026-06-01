import { push } from '@festify/redux-little-router';
import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';

import { showToast } from '../actions';
import { fetchWithAccessToken } from '../util/spotify-auth';
import { currentAuthUser } from '../util/auth';
import { isSelfHostedBackend } from '../util/backend';
import { backendFunctions, BackendUser } from '../util/backend-functions';
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
    setMyParties,
    setMyPartiesLoading,
    END_PARTY_START,
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
    const { player, user, homeView }: State = yield select();
    const spotifyProfile = user.credentials.spotify.user;

    let userDisplayName = '';
    let userCountry = spotifyProfile ? spotifyProfile.country : 'US';
    let hasPremium = false;

    if (isSelfHostedBackend) {
        const backendUser = currentAuthUser() as BackendUser | null;
        if (!backendUser || backendUser.isAnonymous) {
            const e = new Error('Missing Spotify user');
            yield put(createPartyFail(e));
            yield put(showToast('Please log in with Spotify again before hosting a party.', 10000));
            return;
        }

        userDisplayName = backendUser.displayName || backendUser.email || backendUser.uid;
        hasPremium = Boolean(backendUser.spotifyIsPremium);
    } else {
        let spotifyUser = spotifyProfile;
        if (!spotifyUser) {
            try {
                const resp = yield call(fetchWithAccessToken, '/me');
                spotifyUser = yield resp.json();
            } catch (err) {
                const e = new Error('Missing Spotify user');
                yield put(createPartyFail(e));
                yield put(showToast('Please log in with Spotify again before hosting a party.', 10000));
                return;
            }
        }

        userDisplayName = spotifyUser ? (spotifyUser.display_name || spotifyUser.id) : '';
        userCountry = spotifyUser ? spotifyUser.country : userCountry;
        hasPremium = Boolean(spotifyUser && spotifyUser.product === 'premium');
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
        const e = new Error('Party ID is invalid!');
        yield put(joinPartyFail(e));
        return;
    }

    const longId = yield call(resolveShortId, homeView.partyId);

    if (!longId) {
        const e = new Error('Party not found!');
        yield put(joinPartyFail(e));
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

function* onAuthStatusKnown() {
    const { router }: State = yield select();

    if ((router.result || { view: Views.Home }).view !== Views.Home) {
        return;
    }

    if (isSelfHostedBackend) {
        const backendUser = currentAuthUser() as BackendUser | null;
        if (!backendUser || backendUser.isAnonymous) {
            return;
        }

        if (!backendUser.spotifyIsPremium) {
            yield put(
                showToast(
                    // tslint:disable-next-line:max-line-length
                    "To create parties and play music on Festify, you need to have a 'Spotify Premium' account. Please login again using a premium account if you want to host parties.",
                    10000,
                ),
            );
            return;
        }

        yield call(loadMyParties);
        return;
    }

    try {
        const resp = yield call(fetchWithAccessToken, '/me');
        const spotifyUser = yield resp.json();
        if (!spotifyUser || spotifyUser.product !== 'premium') {
            yield put(
                showToast(
                    // tslint:disable-next-line:max-line-length
                    "To create parties and play music on Festify, you need to have a 'Spotify Premium' account. Please login again using a premium account if you want to host parties.",
                    10000,
                ),
            );
        }
    } catch (err) {
        return;
    }
}

export default function*() {
    yield takeLatest(NOTIFY_AUTH_STATUS_KNOWN, onAuthStatusKnown);
    yield takeLatest(CREATE_PARTY_START, createParty);
    yield takeLatest(JOIN_PARTY_START, joinParty);
    yield takeEvery(END_PARTY_START, endParty);
}
