import { createSelector } from 'reselect';

import { State } from '../state';
import { currentAuthUser } from '../util/auth';

export const isPartyOwnerSelector = (state: State) => {
    const fbUser = currentAuthUser();
    return Boolean(
        fbUser && state.party.currentParty && state.party.currentParty.created_by === fbUser.uid,
    );
};

export const partyIdSelector = (state: State): string | null => {
    const params = state.router.params;
    return params ? params.partyId : null;
};

export const playbackMasterSelector = (state: State): string | null => {
    const party = state.party.currentParty;
    return party && party.playback ? party.playback.master_id : null;
};

export const isPlaybackMasterSelector = createSelector(
    playbackMasterSelector,
    state => state.player.instanceId,
    (masterId, instanceId) => masterId === instanceId,
);

export const hasOtherPlaybackMasterSelector = createSelector(
    playbackMasterSelector,
    isPlaybackMasterSelector,
    (pm, isPm) => pm && !isPm,
);

export const playbackSelector = (state: State) =>
    state.party.currentParty && state.party.currentParty.playback ? state.party.currentParty.playback : null;
