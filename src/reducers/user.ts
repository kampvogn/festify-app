import { Actions } from '../actions';
import {
    EXCHANGE_CODE,
    EXCHANGE_CODE_FAIL,
    NOTIFY_AUTH_STATUS_KNOWN,
} from '../actions/auth';
import { CHANGE_DISPLAY_LOGIN_MODAL } from '../actions/view-party';
import { UPDATE_USER_PLAYLISTS } from '../actions/view-party-settings';
import { AuthProviderStatus, UserCredentials, UserState } from '../state';

const defaultUser = <T>(): AuthProviderStatus<T> => ({
    authorizing: false,
    authorizationError: null,
    statusKnown: false,
    user: null,
});

export default function(
    state: UserState = {
        credentials: {
            spotify: defaultUser(),
        },
        playlists: [],
    },
    action: Actions,
): UserState {
    function reduceAuthProvider(
        prov: keyof UserCredentials,
        data: Partial<AuthProviderStatus<SpotifyApi.UserObjectPrivate>>,
    ): UserState {
        return {
            ...state,
            credentials: {
                ...state.credentials,
                [prov]: {
                    ...state.credentials[prov],
                    ...data,
                },
            },
        };
    }

    switch (action.type) {
        case CHANGE_DISPLAY_LOGIN_MODAL:
            return state;
        case EXCHANGE_CODE_FAIL:
            return reduceAuthProvider(action.payload.provider, {
                authorizing: false,
                authorizationError: action.payload.data,
                statusKnown: true,
            });
        case EXCHANGE_CODE:
            return reduceAuthProvider(action.payload, {
                authorizing: true,
                authorizationError: null,
                statusKnown: false,
            });
        case NOTIFY_AUTH_STATUS_KNOWN:
            return reduceAuthProvider(action.payload.provider, {
                authorizing: false,
                authorizationError: null,
                statusKnown: true,
                user: action.payload.data,
            });
        case UPDATE_USER_PLAYLISTS:
            return {
                ...state,
                playlists: action.payload,
            };
        default:
            return state;
    }
}
