import mapValues from 'lodash-es/mapValues';
import omit from 'lodash-es/omit';

import { firebaseTrackIdSelector } from '../selectors/track';
import { Track, TrackReference } from '../state';
import { requireAuth } from '../util/auth';
import { isSelfHostedBackend } from '../util/backend';
import { backendFunctions } from '../util/backend-functions';
import firebase, { firebaseNS } from '../util/firebase';

export type Actions =
    | ReturnType<typeof removeTrackAction>
    | ReturnType<typeof requestSetVoteAction>
    | ReturnType<typeof setVoteAction>;

export const REMOVE_TRACK = 'REMOVE_TRACK';
export const REQUEST_SET_VOTE = 'REQUEST_SET_VOTE';
export const SET_VOTE = 'SET_VOTE';

export const removeTrackAction = (ref: TrackReference, moveToHistory: boolean) => ({
    type: REMOVE_TRACK as typeof REMOVE_TRACK,
    payload: [ref, moveToHistory] as [TrackReference, boolean],
});

export const requestSetVoteAction = (ref: TrackReference, vote: boolean) => ({
    type: REQUEST_SET_VOTE as typeof REQUEST_SET_VOTE,
    payload: [ref, vote],
});

export const setVoteAction = (ref: TrackReference, vote: boolean) => ({
    type: SET_VOTE as typeof SET_VOTE,
    payload: [ref, vote] as [TrackReference, boolean],
});

/* Utils */

export function markTrackAsPlayed(partyId: string, ref: TrackReference): Promise<void> {
    if (isSelfHostedBackend) {
        return backendFunctions.markTrackAsPlayed({
            partyId,
            ref,
        }).then(() => undefined);
    }

    if (!firebase) {
        throw new Error('Firebase is unavailable in this build.');
    }

    return firebase
        .database()
        .ref('/tracks')
        .child(partyId)
        .child(firebaseTrackIdSelector(ref))
        .child('played_at')
        .set(firebaseNS.database!.ServerValue.TIMESTAMP);
}

/**
 * Pins a track to the top of the queue.
 *
 * @param partyId the ID of the affected party
 * @param ref the ref of the track to pin
 */
export function pinTrack(partyId: string, ref: TrackReference): Promise<void> {
    if (isSelfHostedBackend) {
        return backendFunctions.pinTrack({
            partyId,
            ref,
        }).then(() => undefined);
    }

    if (!firebase) {
        throw new Error('Firebase is unavailable in this build.');
    }

    return firebase
        .database()
        .ref('/tracks')
        .child(partyId)
        .child(firebaseTrackIdSelector(ref))
        .child('order')
        .set(Number.MIN_SAFE_INTEGER + 1);
}

export async function removeTrack(partyId: string, track: Track, moveToHistory: boolean) {
    const trackId = firebaseTrackIdSelector(track);

    if (isSelfHostedBackend) {
        await backendFunctions.removeTrack({
            partyId,
            ref: track.reference,
            moveToHistory,
        });
        return;
    }

    if (!firebase) {
        throw new Error('Firebase is unavailable in this build.');
    }

    const updates: any[] = [
        firebase
            .database()
            .ref('/tracks')
            .child(partyId)
            .child(trackId)
            .set(null),
        firebase
            .database()
            .ref('/votes')
            .child(partyId)
            .child(trackId)
            .set(null),
        firebase
            .database()
            .ref('/votes_by_user')
            .child(partyId)
            .transaction(votes => mapValues(votes, userVotes => omit(userVotes, trackId))),
    ];
    if (moveToHistory) {
        updates.push(
            firebase
                .database()
                .ref('/tracks_played')
                .child(partyId)
                .push(track),
        );
    }

    await Promise.all(updates);
}

export async function setVote(partyId: string, ref: TrackReference, vote: boolean) {
    const authUser = await requireAuth();
    if (!authUser) {
        throw new Error('Authentication is required to vote on tracks.');
    }

    const { uid } = authUser;
    const trackId = firebaseTrackIdSelector(ref);

    if (isSelfHostedBackend) {
        await backendFunctions.setTrackVote({
            partyId,
            ref,
            vote,
        });
        return;
    }

    if (!firebase) {
        throw new Error('Firebase is unavailable in this build.');
    }

    const a = firebase
        .database()
        .ref('/votes')
        .child(partyId)
        .child(trackId)
        .child(uid)
        .set(vote);
    const b = firebase
        .database()
        .ref('/votes_by_user')
        .child(partyId)
        .child(uid)
        .child(trackId)
        .set(vote);

    await Promise.all([a, b]);
}
