import shuffleArr from 'lodash-es/shuffle';

import { PartySettings, Playlist, PlaylistReference, Track } from '../state';
import { backendFunctions } from '../util/backend-functions';
import { fetchWithAccessToken } from '../util/spotify-auth';

export type Actions =
    | ReturnType<typeof changeSearchInput>
    | ReturnType<typeof changePartyName>
    | ReturnType<typeof changePartySetting>
    | ReturnType<typeof flushQueueStart>
    | ReturnType<typeof flushQueueFail>
    | ReturnType<typeof flushQueueFinish>
    | ReturnType<typeof insertPlaylistFail>
    | ReturnType<typeof insertPlaylistFinish>
    | ReturnType<typeof insertPlaylistProgress>
    | ReturnType<typeof insertPlaylistStart>
    | ReturnType<typeof loadPlaylistsFail>
    | ReturnType<typeof loadPlaylistsStart>
    | ReturnType<typeof updateUserPlaylists>;

export const UPDATE_PARTY_NAME = 'CHANGE_PARTYNAME';
export const CHANGE_PARTY_SETTING = 'CHANGE_PARTY_SETTING';
export const CHANGE_FALLBACK_PLAYLIST_SEARCH_INPUT = 'CHANGE_FALLBACK_PLAYLIST_SEARCH_INPUT';
export const FLUSH_QUEUE_FAIL = 'FLUSH_QUEUE_Fail';
export const FLUSH_QUEUE_FINISH = 'FLUSH_QUEUE_Finish';
export const FLUSH_QUEUE_START = 'FLUSH_QUEUE_Start';
export const LOAD_PLAYLISTS_FAIL = 'LOAD_PLAYLISTS_Fail';
export const LOAD_PLAYLISTS_START = 'LOAD_PLAYLISTS_Start';
export const INSERT_FALLBACK_PLAYLIST_FAIL = 'INSERT_FALLBACK_PLAYLIST_Fail';
export const INSERT_FALLBACK_PLAYLIST_FINISH = 'INSERT_FALLBACK_PLAYLIST_Finish';
export const INSERT_FALLBACK_PLAYLIST_PROGRESS = 'INSERT_FALLBACK_PLAYLIST_Progress';
export const INSERT_FALLBACK_PLAYLIST_START = 'INSERT_FALLBACK_PLAYLIST_Start';
export const UPDATE_USER_PLAYLISTS = 'UPDATE_USER_PLAYLISTS';

export const changePartyName = (newName: string) => ({
    type: UPDATE_PARTY_NAME as typeof UPDATE_PARTY_NAME,
    payload: newName,
});

export const changePartySetting = <K extends keyof PartySettings>(
    setting: K,
    value: PartySettings[K],
) => ({
    type: CHANGE_PARTY_SETTING as typeof CHANGE_PARTY_SETTING,
    payload: { value, setting },
});

export const changeSearchInput = (newContent: string) => ({
    type: CHANGE_FALLBACK_PLAYLIST_SEARCH_INPUT as typeof CHANGE_FALLBACK_PLAYLIST_SEARCH_INPUT,
    payload: newContent,
});

export const flushQueueFail = (err: Error) => ({
    type: FLUSH_QUEUE_FAIL as typeof FLUSH_QUEUE_FAIL,
    error: true,
    payload: err,
});

export const flushQueueFinish = () => ({ type: FLUSH_QUEUE_FINISH as typeof FLUSH_QUEUE_FINISH });

export const flushQueueStart = () => ({ type: FLUSH_QUEUE_START as typeof FLUSH_QUEUE_START });

export const loadPlaylistsFail = (err: Error) => ({
    type: LOAD_PLAYLISTS_FAIL as typeof LOAD_PLAYLISTS_FAIL,
    error: true,
    payload: err,
});

export const loadPlaylistsStart = () => ({
    type: LOAD_PLAYLISTS_START as typeof LOAD_PLAYLISTS_START,
});

export const insertPlaylistFail = (err: Error) => ({
    type: INSERT_FALLBACK_PLAYLIST_FAIL as typeof INSERT_FALLBACK_PLAYLIST_FAIL,
    error: true,
    payload: err,
});

export const insertPlaylistFinish = () => ({
    type: INSERT_FALLBACK_PLAYLIST_FINISH as typeof INSERT_FALLBACK_PLAYLIST_FINISH,
});

export const insertPlaylistProgress = (itemsProcessed: number) => ({
    type: INSERT_FALLBACK_PLAYLIST_PROGRESS as typeof INSERT_FALLBACK_PLAYLIST_PROGRESS,
    payload: itemsProcessed,
});

export const insertPlaylistStart = (playlist: Playlist, shuffled: boolean) => ({
    type: INSERT_FALLBACK_PLAYLIST_START as typeof INSERT_FALLBACK_PLAYLIST_START,
    payload: { playlist, shuffled },
});

export const updateUserPlaylists = (playlists: Playlist[]) => ({
    type: UPDATE_USER_PLAYLISTS as typeof UPDATE_USER_PLAYLISTS,
    payload: playlists,
});

/* Utils */

export async function flushQueue(partyId: string, _tracks: Track[]) {
    await backendFunctions.flushQueue({ partyId });
}

export async function loadPlaylists(): Promise<Playlist[]> {
    const items: SpotifyApi.PlaylistObjectSimplified[] = [];
    let url = '/me/playlists?limit=50';
    do {
        const resp = await fetchWithAccessToken(url);
        const body: SpotifyApi.ListOfUsersPlaylistsResponse = await resp.json();

        items.push(...body.items);
        url = body.next;
    } while (url);

    return items.map(({ name, id, owner, tracks }) => ({
        name,
        reference: {
            id,
            provider: 'spotify',
            userId: owner.id,
        } as PlaylistReference,
        trackCount: tracks.total,
    }));
}

export async function insertPlaylist(
    _partyId: string,
    _partyCreationDate: number,
    _playlist: Playlist,
    _shuffle: boolean = false,
    _progress?: (amount: number) => any,
) {
    throw new Error('Fallback playlists are not yet available in self-hosted mode.');
}
