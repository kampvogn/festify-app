import { LOCATION_CHANGED } from '@festify/redux-little-router';
import { all, call, cancel, put, select, takeEvery, takeLatest } from 'redux-saga/effects';

import {
    getArtistFanart,
    getMusicBrainzId,
    updateMetadata,
    MetadataStore,
    UPDATE_METADATA,
} from '../actions/metadata';
import { UPDATE_TRACKS } from '../actions/party-data';
import { Views } from '../routing';
import { loadFanartTracksSelector, loadMetadataSelector } from '../selectors/track';
import { Metadata, State, TrackReference } from '../state';
import { takeEveryWithState } from '../util/saga';
import { getProvider } from '../util/provider-registry';

const cache = new MetadataStore();

let hasThrownIdbError = false;
function* cacheMetadata(ac: ReturnType<typeof updateMetadata>) {
    try {
        yield cache.cacheMetadata(ac.payload);
    } catch (err) {
        if (hasThrownIdbError) {
            return;
        }
        hasThrownIdbError = true;
        console.warn('Failed to cache metadata to IndexedDB.', err);
    }
}

const emptyArray = [];
function* loadFanartForNewTracks(_) {
    const remaining: [string, Metadata][] = yield select(loadFanartTracksSelector);

    for (const [trackId, metadata] of remaining) {
        const empty = () => ({ [trackId]: emptyArray });

        try {
            const likeliestArtist: string | null = yield call(getMusicBrainzId, metadata);
            if (!likeliestArtist) {
                yield put(updateMetadata(empty()));
                continue;
            }

            const backgrounds: string[] | null = yield call(getArtistFanart, likeliestArtist);
            if (!backgrounds) {
                yield put(updateMetadata(empty()));
                continue;
            }

            yield put(updateMetadata({ [trackId]: backgrounds }));
        } catch (err) {
            console.error(`Failed to fetch fanart for '${metadata.name}'.`, err);
        }
    }
}

let loadFanartTask;
function* watchTvMode(action, prevView: Views, newView: Views) {
    if (loadFanartTask && prevView === newView) {
        return;
    }

    if (newView === Views.Tv) {
        loadFanartTask = yield takeLatest([UPDATE_TRACKS, UPDATE_METADATA], loadFanartForNewTracks);

        yield* loadFanartForNewTracks(null);
    } else if (prevView === Views.Tv) {
        yield cancel(loadFanartTask);
        loadFanartTask = null;
    }
}

function* loadMetadataForNewTracks(_) {
    const state: State = yield select();
    const remaining: TrackReference[] = loadMetadataSelector(state);

    if (!state.party.currentParty || !remaining.length) {
        return;
    }

    try {
        const fullIds = remaining.map(ref => `${ref.provider}-${ref.id}`);
        const cached: Record<string, Metadata> = yield cache.getMetadata(fullIds);
        yield put(updateMetadata(cached));
    } catch (err) {
        console.warn('Failed to load cached tracks from IndexedDB. Fetching from provider API...');
    }

    const country = state.party.currentParty.country;
    const uncached: TrackReference[] = yield select(loadMetadataSelector);

    // Group by provider so each provider fetches its own tracks
    const byProvider = uncached.reduce((acc, ref) => {
        if (!acc[ref.provider]) acc[ref.provider] = [];
        acc[ref.provider].push(ref.id);
        return acc;
    }, {} as Record<string, string[]>);

    for (const providerName of Object.keys(byProvider)) {
        const ids = byProvider[providerName];
        try {
            const provider = getProvider(providerName);
            const metadata: Record<string, Metadata> = yield call(
                [provider, 'getMetadata'],
                ids,
                country,
            );
            yield put(updateMetadata(metadata));
        } catch (err) {
            console.error(`Failed to load metadata from provider '${providerName}'.`, err);
        }
    }
}

export default function*() {
    yield takeEvery(UPDATE_METADATA, cacheMetadata),
        yield takeLatest(UPDATE_TRACKS, loadMetadataForNewTracks),
        yield takeEveryWithState(
            LOCATION_CHANGED,
            (s: State) => (s.router!.result || { view: Views.Home }).view,
            watchTvMode,
        );
}
