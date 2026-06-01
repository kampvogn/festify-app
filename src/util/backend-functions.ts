import { backendConfig, isSelfHostedBackend } from './backend';
import { functions as firebaseFunctions } from './firebase';

export interface CallableResult<T> {
    data: T;
}

export interface ClientTokenResult {
    accessToken: string;
    expiresIn: number;
}

export interface ExchangeCodeResult extends ClientTokenResult {
    refreshToken: string;
    tokenType?: string;
}

export interface MyParty {
    id: string;
    name: string;
    short_id: string;
    created_at: number;
}

export interface BackendUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    isAnonymous: boolean;
    providerId: string;
    spotifyIsPremium?: boolean;
}

export interface SessionResult {
    sessionToken: string;
    user: BackendUser;
}

export interface BackendTrack {
    added_at: number;
    is_fallback: boolean;
    order: number;
    reference: {
        provider: 'spotify';
        id: string;
    };
    played_at?: number;
    vote_count: number;
}

export interface BackendParty {
    id: string;
    country: string;
    created_at: number;
    created_by: string;
    name: string;
    playback: any;
    settings: any;
    short_id: string;
}

export interface BackendPartySnapshot {
    party: BackendParty;
    tracks: Record<string, BackendTrack>;
    userVotes: Record<string, boolean>;
}

async function deleteSelfHosted<T>(path: string): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Self-hosted backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

async function getSelfHosted<T>(path: string): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        credentials: 'include',
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Self-hosted backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

async function postSelfHosted<T>(path: string, body?: object): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Self-hosted backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

export const backendFunctions = {
    anonymousAuth(): Promise<CallableResult<SessionResult>> {
        if (isSelfHostedBackend) {
            return postSelfHosted<SessionResult>('/api/auth/anonymous');
        }

        throw new Error('Anonymous backend auth is only available with the self-hosted backend.');
    },

    getMe(): Promise<CallableResult<BackendUser>> {
        return getSelfHosted<BackendUser>('/api/auth/me');
    },

    signOut(): Promise<CallableResult<{ ok: boolean }>> {
        return postSelfHosted<{ ok: boolean }>('/api/auth/signout');
    },

    clientToken(): Promise<CallableResult<ClientTokenResult>> {
        if (isSelfHostedBackend) {
            return postSelfHosted<ClientTokenResult>('/api/spotify/client-token');
        }

        return firebaseFunctions.clientToken({}) as any;
    },

    exchangeCode(data: { callbackUrl: string; code: string }): Promise<CallableResult<ExchangeCodeResult>> {
        if (isSelfHostedBackend) {
            return postSelfHosted<ExchangeCodeResult>('/api/spotify/exchange-code', data);
        }

        return firebaseFunctions.exchangeCode(data) as any;
    },

    refreshToken(data: { refreshToken: string }): Promise<CallableResult<ClientTokenResult>> {
        if (isSelfHostedBackend) {
            return postSelfHosted<ClientTokenResult>('/api/spotify/refresh-token', data);
        }

        return firebaseFunctions.refreshToken(data) as any;
    },

    isSpotifyUser(data: { email: string }) {
        return firebaseFunctions.isSpotifyUser(data);
    },

    linkSpotifyAccounts(data: { accessToken: string }) {
        if (isSelfHostedBackend) {
            return postSelfHosted<SessionResult>('/api/spotify/link-account', data);
        }

        return firebaseFunctions.linkSpotifyAccounts(data);
    },

    getMyParties(): Promise<CallableResult<MyParty[]>> {
        return getSelfHosted<MyParty[]>('/api/parties/mine');
    },

    deleteParty(partyId: string): Promise<CallableResult<{ ok: boolean }>> {
        return deleteSelfHosted<{ ok: boolean }>('/api/parties/' + encodeURIComponent(partyId));
    },

    createParty(data: { displayName: string; name?: string; country: string; settings: any }) {
        return postSelfHosted<BackendParty>('/api/parties', data);
    },

    resolveParty(shortId: string) {
        return getSelfHosted<{ partyId: string | null }>('/api/parties/resolve/' + encodeURIComponent(shortId));
    },

    getParty(partyId: string) {
        return getSelfHosted<BackendPartySnapshot>('/api/parties/' + encodeURIComponent(partyId));
    },

    setTrackVote(data: { partyId: string; ref: { provider: 'spotify'; id: string }; vote: boolean }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/vote', data);
    },

    removeTrack(data: { partyId: string; ref: { provider: 'spotify'; id: string }; moveToHistory: boolean }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/remove', data);
    },

    pinTrack(data: { partyId: string; ref: { provider: 'spotify'; id: string } }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/pin', data);
    },

    markTrackAsPlayed(data: { partyId: string; ref: { provider: 'spotify'; id: string } }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/played', data);
    },

    flushQueue(data: { partyId: string }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/flush', data);
    },

    updatePlaybackState(data: { partyId: string; playback: any }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/playback', data);
    },
};
