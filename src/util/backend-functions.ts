import { backendConfig } from './backend';

export interface CallableResult<T> {
    data: T;
}

export interface ClientTokenResult {
    accessToken: string;
    expiresIn: number;
}

export interface ExchangeCodeResult extends ClientTokenResult {
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
        provider: string;
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

async function postSelfHosted<T>(path: string, body?: object): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

async function patchSelfHosted<T>(path: string, body: object): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

async function deleteSelfHosted<T>(path: string): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

async function getSelfHosted<T>(path: string): Promise<CallableResult<T>> {
    const response = await fetch(backendConfig.apiUrl + path, {
        credentials: 'include',
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Backend request failed with ' + response.status);
    }

    return { data: await response.json() };
}

export const backendFunctions = {
    anonymousAuth(): Promise<CallableResult<SessionResult>> {
        return postSelfHosted<SessionResult>('/api/auth/anonymous');
    },

    getMe(): Promise<CallableResult<BackendUser>> {
        return getSelfHosted<BackendUser>('/api/auth/me');
    },

    signOut(): Promise<CallableResult<{ ok: boolean }>> {
        return postSelfHosted<{ ok: boolean }>('/api/auth/signout');
    },

    clientToken(): Promise<CallableResult<ClientTokenResult>> {
        return postSelfHosted<ClientTokenResult>('/api/spotify/client-token');
    },

    exchangeCode(data: { callbackUrl: string; code: string }): Promise<CallableResult<ExchangeCodeResult>> {
        return postSelfHosted<ExchangeCodeResult>('/api/spotify/exchange-code', data);
    },

    refreshToken(): Promise<CallableResult<ClientTokenResult>> {
        return postSelfHosted<ClientTokenResult>('/api/spotify/refresh-token');
    },

    linkSpotifyAccounts(data: { accessToken: string }) {
        return postSelfHosted<SessionResult>('/api/spotify/link-account', data);
    },

    getMyParties(): Promise<CallableResult<MyParty[]>> {
        return getSelfHosted<MyParty[]>('/api/parties/mine');
    },

    renameParty(partyId: string, name: string): Promise<CallableResult<{ id: string; name: string }>> {
        return patchSelfHosted<{ id: string; name: string }>('/api/parties/' + encodeURIComponent(partyId), { name });
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

    setTrackVote(data: { partyId: string; ref: { provider: string; id: string }; vote: boolean }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/vote', data);
    },

    removeTrack(data: { partyId: string; ref: { provider: string; id: string }; moveToHistory: boolean }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/remove', data);
    },

    pinTrack(data: { partyId: string; ref: { provider: string; id: string } }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/pin', data);
    },

    markTrackAsPlayed(data: { partyId: string; ref: { provider: string; id: string } }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/played', data);
    },

    flushQueue(data: { partyId: string }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/tracks/flush', data);
    },

    updatePartySettings(partyId: string, settings: Partial<import('../state').PartySettings>) {
        return patchSelfHosted<{ ok: boolean }>(
            '/api/parties/' + encodeURIComponent(partyId) + '/settings',
            settings,
        );
    },

    updatePlaybackState(data: { partyId: string; playback: any }) {
        return postSelfHosted('/api/parties/' + encodeURIComponent(data.partyId) + '/playback', data);
    },
};
