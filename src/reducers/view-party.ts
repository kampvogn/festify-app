import { LOCATION_CHANGED } from '@festify/redux-little-router';

import { Actions } from '../actions';
import { CLEANUP_PARTY } from '../actions/party-data';
import {
    CHANGE_DISPLAY_LOGIN_MODAL,
    CLOSE_DRILL_DOWN,
    DRILL_DOWN_FAIL,
    DRILL_DOWN_FINISH,
    DRILL_DOWN_START,
    SEARCH_FAIL,
    SEARCH_FINISH,
    SEARCH_START,
} from '../actions/view-party';
import { TOGGLE_USER_MENU } from '../actions/view-queue-drawer';
import { PartyViewState } from '../state';

export default function(
    state: PartyViewState = {
        loginModalOpen: false,
        searchInProgress: false,
        searchError: null,
        searchResult: null,
        searchAlbums: null,
        searchPlaylists: null,
        drillDown: null,
        drillDownInProgress: false,
        drillDownError: null,
        userMenuOpen: false,
    },
    action: Actions,
): PartyViewState {
    switch (action.type) {
        case CHANGE_DISPLAY_LOGIN_MODAL:
            return {
                ...state,
                loginModalOpen: action.payload,
            };
        case LOCATION_CHANGED:
            return {
                ...state,
                searchResult:
                    !(action as any).payload.params || !(action as any).payload.params.query
                        ? null
                        : state.searchResult,
            };
        case SEARCH_START:
            return {
                ...state,
                searchInProgress: true,
                searchError: null,
            };
        case SEARCH_FAIL:
            return {
                ...state,
                searchInProgress: false,
                searchError: action.payload,
            };
        case SEARCH_FINISH:
            return {
                ...state,
                searchInProgress: false,
                searchError: null,
                searchResult: (action as any).payload.trackRecords,
                searchAlbums: (action as any).payload.albums,
                searchPlaylists: (action as any).payload.playlists,
            };
        case DRILL_DOWN_START:
            return {
                ...state,
                drillDownInProgress: true,
                drillDownError: null,
            };
        case DRILL_DOWN_FINISH:
            return {
                ...state,
                drillDownInProgress: false,
                drillDownError: null,
                drillDown: (action as any).payload,
            };
        case DRILL_DOWN_FAIL:
            return {
                ...state,
                drillDownInProgress: false,
                drillDownError: (action as any).payload,
            };
        case CLOSE_DRILL_DOWN:
            return {
                ...state,
                drillDown: null,
                drillDownError: null,
            };
        case TOGGLE_USER_MENU:
            return {
                ...state,
                userMenuOpen: !state.userMenuOpen,
            };
        case CLEANUP_PARTY:
            return {
                ...state,
                searchInProgress: false,
                searchError: null,
                searchResult: null,
                searchAlbums: null,
                searchPlaylists: null,
                drillDown: null,
                drillDownInProgress: false,
                drillDownError: null,
                userMenuOpen: false,
            };
        default:
            return state;
    }
}
