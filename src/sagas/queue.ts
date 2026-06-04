import { call, fork, put, select, take, takeEvery } from 'redux-saga/effects';

import { showToast } from '../actions';
import { updateConnectionState, updateParty, updateTracks, updateUserVotes, UPDATE_TRACKS } from '../actions/party-data';
import {
    pinTrack,
    removeTrack as doRemoveTrack,
    removeTrackAction,
    setVote as doSetVote,
    setVoteAction,
    REMOVE_TRACK,
    REQUEST_SET_VOTE,
} from '../actions/queue';
import { changeDisplayLoginModal } from '../actions/view-party';
import { isPartyOwnerSelector, isPlaybackMasterSelector } from '../selectors/party';
import {
    currentTrackSelector,
    firebaseTrackIdSelector,
    singleTrackSelector,
    tracksEqual,
} from '../selectors/track';
import { ConnectionState, State, Track } from '../state';
import { requireAuth } from '../util/auth';
import { BackendUser, backendFunctions } from '../util/backend-functions';

function* refreshParty(partyId: string) {
    const { data: snapshot } = yield call(backendFunctions.getParty, partyId);
    yield put(updateParty(snapshot.party));
    yield put(updateTracks(snapshot.tracks));
    yield put(updateUserVotes(snapshot.userVotes));
    yield put(updateConnectionState(ConnectionState.Connected));
}

function* pinTopTrack(partyId: string) {
    let topTrack: Track = undefined!;

    while (true) {
        yield take(UPDATE_TRACKS);

        const state: State = yield select();

        const isOwner = isPartyOwnerSelector(state);
        const isPlaybackMaster = isPlaybackMasterSelector(state);
        const newTopTrack = currentTrackSelector(state);

        if (!isOwner || !isPlaybackMaster || !newTopTrack || tracksEqual(topTrack, newTopTrack)) {
            continue;
        }

        topTrack = newTopTrack;
        yield call(pinTrack, partyId, newTopTrack.reference);
        yield call(refreshParty, partyId);
    }
}

function* removeTrack(partyId: string, ac: ReturnType<typeof removeTrackAction>) {
    try {
        const [ref, moveToHistory] = ac.payload;
        const state: State = yield select();
        const track = singleTrackSelector(state, firebaseTrackIdSelector(ref));

        yield call(doRemoveTrack, partyId, track, moveToHistory);
        yield call(refreshParty, partyId);
    } catch (err) {
        yield put(showToast(`Failed to remove track: ${err}`));
    }
}

function* setVote(partyId: string, ac: ReturnType<typeof setVoteAction>) {
    const { party }: State = yield select();
    if (party.currentParty!.settings && !party.currentParty!.settings!.allow_anonymous_voters) {
        const user: BackendUser | null = yield call(requireAuth);
        if (!user || user.isAnonymous) {
            yield put(changeDisplayLoginModal(true));
            return;
        }
    }

    const [ref, vote] = ac.payload;
    yield put(setVoteAction(ref, vote));
    try {
        yield call(doSetVote, partyId, ref, vote);
        yield call(refreshParty, partyId);
    } catch (err) {
        yield put(showToast(`Failed to toggle vote: ${err}`));
    }
}

export default function*(partyId: string) {
    yield takeEvery(REMOVE_TRACK, removeTrack, partyId);
    yield takeEvery(REQUEST_SET_VOTE, setVote, partyId);
    yield fork(pinTopTrack, partyId);
}
