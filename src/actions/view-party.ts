import { AlbumSearchResult, DrillDownState, PlaylistSearchResult, Track } from '../state';

export type Actions =
    | ReturnType<typeof changeDisplayLoginModal>
    | ReturnType<typeof changeTrackSearchInput>
    | ReturnType<typeof searchFail>
    | ReturnType<typeof searchFinish>
    | ReturnType<typeof searchStart>
    | ReturnType<typeof drillDownStart>
    | ReturnType<typeof drillDownFinish>
    | ReturnType<typeof drillDownFail>
    | ReturnType<typeof closeDrillDown>;

export const CHANGE_DISPLAY_LOGIN_MODAL = 'CHANGE_DISPLAY_LOGIN_MODAL';
export const CHANGE_TRACK_SEARCH_INPUT = 'CHANGE_TRACK_SEARCH_INPUT';
export const SEARCH_FAIL = 'SEARCH_Fail';
export const SEARCH_FINISH = 'SEARCH_Finish';
export const SEARCH_START = 'SEARCH_Start';
export const DRILL_DOWN_START = 'DRILL_DOWN_START';
export const DRILL_DOWN_FINISH = 'DRILL_DOWN_FINISH';
export const DRILL_DOWN_FAIL = 'DRILL_DOWN_FAIL';
export const CLOSE_DRILL_DOWN = 'CLOSE_DRILL_DOWN';
export const TRIGGER_DRILL_DOWN = 'TRIGGER_DRILL_DOWN';

export const changeDisplayLoginModal = (display: boolean) => ({
    type: CHANGE_DISPLAY_LOGIN_MODAL as typeof CHANGE_DISPLAY_LOGIN_MODAL,
    payload: display,
});

export const changeTrackSearchInput = (text: string) => ({
    type: CHANGE_TRACK_SEARCH_INPUT as typeof CHANGE_TRACK_SEARCH_INPUT,
    payload: text,
});

export const eraseTrackSearchInput = () => changeTrackSearchInput('');

export const searchFail = (error: Error) => ({
    type: SEARCH_FAIL as typeof SEARCH_FAIL,
    error: true,
    payload: error,
});

export const searchFinish = (payload: {
    trackRecords: Record<string, Track>;
    albums: AlbumSearchResult[];
    playlists: PlaylistSearchResult[];
}) => ({
    type: SEARCH_FINISH as typeof SEARCH_FINISH,
    payload,
});

export const searchStart = () => ({ type: SEARCH_START as typeof SEARCH_START });

export const drillDownStart = () => ({ type: DRILL_DOWN_START as typeof DRILL_DOWN_START });

export const drillDownFinish = (state: DrillDownState) => ({
    type: DRILL_DOWN_FINISH as typeof DRILL_DOWN_FINISH,
    payload: state,
});

export const drillDownFail = (error: Error) => ({
    type: DRILL_DOWN_FAIL as typeof DRILL_DOWN_FAIL,
    error: true,
    payload: error,
});

export const closeDrillDown = () => ({ type: CLOSE_DRILL_DOWN as typeof CLOSE_DRILL_DOWN });

export const triggerDrillDown = (id: string, type: 'album' | 'playlist', name: string) => ({
    type: TRIGGER_DRILL_DOWN as typeof TRIGGER_DRILL_DOWN,
    payload: { id, type, name },
});
