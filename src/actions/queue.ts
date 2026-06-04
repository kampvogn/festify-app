import { Track, TrackReference } from '../state';
import { backendFunctions } from '../util/backend-functions';

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

export function markTrackAsPlayed(_partyId: string, _ref: TrackReference): Promise<void> {
    return Promise.resolve();
}

export function pinTrack(partyId: string, ref: TrackReference): Promise<void> {
    return backendFunctions.pinTrack({ partyId, ref }).then(() => undefined);
}

export async function removeTrack(partyId: string, track: Track, moveToHistory: boolean) {
    await backendFunctions.removeTrack({
        partyId,
        ref: track.reference,
        moveToHistory,
    });
}

export async function setVote(partyId: string, ref: TrackReference, vote: boolean) {
    await backendFunctions.setTrackVote({ partyId, ref, vote });
}
