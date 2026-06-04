import { UserCredentials } from '../state';
import { backendFunctions, BackendUser } from './backend-functions';

const SELF_HOSTED_AUTH_KEY = 'SelfHostedAuthData';

export class SelfHostedAuthData {
    static load(): SelfHostedAuthData | null {
        const lsString = localStorage[SELF_HOSTED_AUTH_KEY];
        if (!lsString) {
            return null;
        }
        try {
            const parsed = JSON.parse(lsString);
            const user = parsed.user || parsed;
            return user && user.uid ? new SelfHostedAuthData(user) : null;
        } catch {
            return null;
        }
    }

    static save(user: BackendUser) {
        localStorage[SELF_HOSTED_AUTH_KEY] = JSON.stringify({ user });
    }

    static remove() {
        localStorage.removeItem(SELF_HOSTED_AUTH_KEY);
    }

    user: BackendUser;

    constructor(user: BackendUser) {
        this.user = user;
    }
}

export function currentAuthUser(): BackendUser | null {
    const data = SelfHostedAuthData.load();
    return data ? data.user : null;
}

export async function signOutAuth(): Promise<void> {
    SelfHostedAuthData.remove();
    await backendFunctions.signOut();
}

export async function saveSelfHostedSession(data: import('./backend-functions').SessionResult): Promise<BackendUser> {
    SelfHostedAuthData.save(data.user);
    return data.user;
}

export class AuthData {
    static loadFrom(localStorageKey: string): AuthData {
        const lsString = localStorage[localStorageKey];
        if (!lsString) {
            throw new Error('Missing authentication data.');
        }

        const authData = JSON.parse(lsString);
        if (!authData) {
            throw new Error('Missing authentication data.');
        }

        const { accessToken, expiresAt } = authData;
        return new AuthData(accessToken, expiresAt);
    }

    static remove(localStorageKey: string) {
        localStorage[localStorageKey] = undefined;
    }

    accessToken: string;
    expiresAt: number;

    constructor(accessToken: string, expiresAt: number) {
        this.accessToken = accessToken;
        this.expiresAt = expiresAt;
    }

    get isValid(): boolean {
        return !!this.accessToken && this.expiresAt > Date.now() + 10000;
    }

    saveTo(localStorageKey: string): void {
        localStorage[localStorageKey] = JSON.stringify({
            accessToken: this.accessToken,
            expiresAt: this.expiresAt,
        });
    }
}

export async function requireAuth(): Promise<BackendUser | null> {
    const cached = SelfHostedAuthData.load();
    if (cached) {
        return cached.user;
    }

    try {
        const { data: meUser } = await backendFunctions.getMe();
        if (meUser && meUser.uid) {
            SelfHostedAuthData.save(meUser);
            return meUser;
        }
    } catch {
        // Not authenticated yet — fall through to create anonymous session
    }

    const { data } = await backendFunctions.anonymousAuth();
    SelfHostedAuthData.save(data.user);
    return data.user;
}

// Kept for compatibility with reducers that check provider-linked status
export function getProvider(_prov: Exclude<keyof UserCredentials, 'spotify' | 'firebase'>) {
    throw new Error('Only Spotify login is supported.');
}
