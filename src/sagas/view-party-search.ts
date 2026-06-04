import { push, replace, LOCATION_CHANGED } from '@festify/redux-little-router';
import { delay } from 'redux-saga';
import { call, put, select, take, takeEvery, takeLatest } from 'redux-saga/effects';

import { updateMetadata } from '../actions/metadata';
import { UPDATE_PARTY } from '../actions/party-data';
import { setVoteAction, SET_VOTE } from '../actions/queue';
import {
    changeTrackSearchInput,
    searchFail,
    searchFinish,
    searchStart,
    CHANGE_TRACK_SEARCH_INPUT,
} from '../actions/view-party';
import { PartyViews } from '../routing';
import { queueRouteSelector, searchRouteSelector } from '../selectors/routes';
import { State, Track, Metadata } from '../state';
import { SearchResult } from '../util/music-provider';
import { getProvider } from '../util/provider-registry';

function* doSearch(action) {
    const { party }: State = yield select();
    if (!party.currentParty) {
        yield take(UPDATE_PARTY);
    }

    const {
        query: { s },
    } = action.payload || { query: { s: '' } };
    if (!s) {
        return;
    }

    yield put(searchStart());
    yield call(delay, 500);

    const {
        party: { currentParty },
    }: State = yield select();

    const provider = getProvider('spotify');
    let results: SearchResult[] = [];
    try {
        results = yield call([provider, 'search'], s, currentParty!.country);
    } catch (e) {
        yield put(searchFail(e));
        return;
    }

    const allowExplicit = !currentParty!.settings || currentParty!.settings!.allow_explicit_tracks;
    const filtered = allowExplicit ? results : results.filter(r => !r.explicit);

    const trackRecords = filtered.reduce((acc, r, i) => {
        acc[`${r.provider}-${r.id}`] = {
            added_at: Date.now(),
            is_fallback: false,
            order: i,
            reference: { provider: r.provider, id: r.id },
            vote_count: 0,
        } as Track;
        return acc;
    }, {} as Record<string, Track>);

    const metadata = filtered.reduce((acc, r) => {
        acc[`${r.provider}-${r.id}`] = {
            artists: r.artists,
            cover: r.cover,
            durationMs: r.durationMs,
            isPlayable: r.isPlayable,
            isrc: r.isrc,
            name: r.name,
        } as Metadata;
        return acc;
    }, {} as Record<string, Metadata>);

    yield put(updateMetadata(metadata));
    yield put(searchFinish(trackRecords));
}

function* enforceMultiVoteSetting(ac: ReturnType<typeof setVoteAction>) {
    const state: State = yield select();
    if (!state.party.currentParty || !state.party.currentParty.settings) {
        return;
    }

    const hasVoted: boolean = ac.payload[1];
    if (
        !state.party.currentParty.settings.allow_multi_track_add &&
        state.router.result!.subView === PartyViews.Search &&
        hasVoted
    ) {
        yield put(push(queueRouteSelector(state)!));
    }
}

function* updateUrl(action: ReturnType<typeof changeTrackSearchInput>) {
    const state: State = yield select();
    const { s } = state.router!.query || { s: '' };

    if (!action.payload) {
        yield put(push(queueRouteSelector(state)!, {}));
        return;
    }

    const routerFn = s ? replace : push;
    yield put(routerFn(searchRouteSelector(state, action.payload)!, {}));
}

export default function* () {
    yield takeLatest(LOCATION_CHANGED, doSearch);
    yield takeEvery(CHANGE_TRACK_SEARCH_INPUT, updateUrl);
    yield takeEvery(SET_VOTE, enforceMultiVoteSetting);
}
