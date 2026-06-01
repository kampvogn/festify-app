import { MyParty } from '../state';

export type Actions =
    | ReturnType<typeof changePartyId>
    | ReturnType<typeof changeCreatePartyName>
    | ReturnType<typeof showCreatePartyForm>
    | ReturnType<typeof hideCreatePartyForm>
    | ReturnType<typeof setMyParties>
    | ReturnType<typeof setMyPartiesLoading>
    | ReturnType<typeof endPartyStart>;

export const CHANGE_PARTY_ID = 'CHANGE_PARTY_ID';
export const CHANGE_CREATE_PARTY_NAME = 'CHANGE_CREATE_PARTY_NAME';
export const SHOW_CREATE_PARTY_FORM = 'SHOW_CREATE_PARTY_FORM';
export const HIDE_CREATE_PARTY_FORM = 'HIDE_CREATE_PARTY_FORM';
export const SET_MY_PARTIES = 'SET_MY_PARTIES';
export const SET_MY_PARTIES_LOADING = 'SET_MY_PARTIES_LOADING';
export const END_PARTY_START = 'END_PARTY_START';

export const changePartyId = (partyId: string) => ({
    type: CHANGE_PARTY_ID as typeof CHANGE_PARTY_ID,
    payload: partyId,
});

export const changeCreatePartyName = (name: string) => ({
    type: CHANGE_CREATE_PARTY_NAME as typeof CHANGE_CREATE_PARTY_NAME,
    payload: name,
});

export const showCreatePartyForm = () => ({
    type: SHOW_CREATE_PARTY_FORM as typeof SHOW_CREATE_PARTY_FORM,
});

export const hideCreatePartyForm = () => ({
    type: HIDE_CREATE_PARTY_FORM as typeof HIDE_CREATE_PARTY_FORM,
});

export const setMyParties = (parties: MyParty[] | null) => ({
    type: SET_MY_PARTIES as typeof SET_MY_PARTIES,
    payload: parties,
});

export const setMyPartiesLoading = (loading: boolean) => ({
    type: SET_MY_PARTIES_LOADING as typeof SET_MY_PARTIES_LOADING,
    payload: loading,
});

export const endPartyStart = (partyId: string) => ({
    type: END_PARTY_START as typeof END_PARTY_START,
    payload: partyId,
});
