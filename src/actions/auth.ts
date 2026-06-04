import { BackendUser } from '../util/backend-functions';
import { UserCredentials } from '../state';
import { showToast } from '.';

export type Actions =
    | ReturnType<typeof checkLoginStatus>
    | ReturnType<typeof exchangeCodeFail>
    | ReturnType<typeof exchangeCodeStart>
    | ReturnType<typeof logout>
    | ReturnType<typeof notifyAuthStatusKnown>
    | ReturnType<typeof triggerOAuthLogin>;

export type OAuthLoginProviders = Exclude<keyof UserCredentials, 'firebase'>;

export const CHECK_LOGIN_STATUS = 'CHECK_LOGIN_STATUS';
export const EXCHANGE_CODE = 'EXCHANGE_CODE';
export const EXCHANGE_CODE_FAIL = 'EXCHANGE_CODE_FAIL';
export const LOGOUT = 'LOGOUT';
export const NOTIFY_AUTH_STATUS_KNOWN = 'NOTIFY_AUTH_STATUS_KNOWN';
export const TRIGGER_OAUTH_LOGIN = 'TRIGGER_OAUTH_LOGIN';

export const checkLoginStatus = () => ({ type: CHECK_LOGIN_STATUS as typeof CHECK_LOGIN_STATUS });

export const exchangeCodeStart = (prov: keyof UserCredentials) => ({
    type: EXCHANGE_CODE as typeof EXCHANGE_CODE,
    payload: prov,
});

export const exchangeCodeFail = (provider: keyof UserCredentials, err: Error) => ({
    type: EXCHANGE_CODE_FAIL as typeof EXCHANGE_CODE_FAIL,
    error: true,
    payload: { provider, data: err },
});

export const logout = () => ({ type: LOGOUT as typeof LOGOUT });

export const notifyAuthStatusKnown = (
    provider: keyof UserCredentials,
    user: SpotifyApi.UserObjectPrivate | null,
) => ({
    type: NOTIFY_AUTH_STATUS_KNOWN as typeof NOTIFY_AUTH_STATUS_KNOWN,
    payload: { provider, data: user },
});

export const triggerOAuthLogin = (provider: OAuthLoginProviders) => ({
    type: TRIGGER_OAUTH_LOGIN as typeof TRIGGER_OAUTH_LOGIN,
    payload: provider,
});

export const welcomeUser = (user: BackendUser) =>
    showToast(user.displayName ? `Welcome, ${user.displayName}!` : 'Welcome!');
