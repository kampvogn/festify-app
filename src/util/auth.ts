import { User } from '@firebase/auth-types';

import { UserCredentials } from '../state';

import { isSelfHostedBackend } from './backend';
import { backendFunctions, BackendUser, SessionResult } from './backend-functions';
import firebase, { firebaseNS } from './firebase';

const SELF_HOSTED_AUTH_KEY = 'SelfHostedAuthData';

export class SelfHostedAuthData {
    static load(): SelfHostedAuthData | null {
        const lsString = localStorage[SELF_HOSTED_AUTH_KEY];
        if (!lsString) {
            return null;
        }
        try {
            const parsed = JSON.parse(lsString);
            // Support both old format {sessionToken, user} and new format {user}
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

export function currentAuthUser(): User | BackendUser | null {
    if (isSelfHostedBackend) {
        const data = SelfHostedAuthData.load();
        return data ? data.user : null;
    }

    if (!firebase) {
        return null;
    }

    return firebase.auth().currentUser;
}

export function currentBackendAuthUser(): BackendUser | null {
    const user = currentAuthUser();
    return isSelfHostedBackend ? (user as BackendUser | null) : null;
}

export async function signOutAuth(): Promise<void> {
    if (isSelfHostedBackend) {
        SelfHostedAuthData.remove();
        await backendFunctions.signOut();
        return;
    }

    if (!firebase) {
        return;
    }

    await firebase.auth().signOut();
}

export async function saveSelfHostedSession(data: SessionResult): Promise<BackendUser> {
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

        const { accessToken, expiresAt, refreshToken } = authData;
        return new AuthData(accessToken, expiresAt, refreshToken);
    }

    static remove(localStorageKey: string) {
        localStorage[localStorageKey] = undefined;
    }

    accessToken: string;
    expiresAt: number;
    refreshToken: string;

    constructor(accessToken: string, expiresAt: number, refreshToken: string) {
        this.accessToken = accessToken;
        this.expiresAt = expiresAt;
        this.refreshToken = refreshToken;
    }

    get isValid(): boolean {
        return !!this.accessToken && this.expiresAt > Date.now() + 10000;
    }

    saveTo(localStorageKey: string): void {
        localStorage[localStorageKey] = JSON.stringify({
            accessToken: this.accessToken,
            expiresAt: this.expiresAt,
            refreshToken: this.refreshToken,
        });
    }
}

export function getProvider(prov: Exclude<keyof UserCredentials, 'spotify' | 'firebase'>) {
    const auth = firebaseNS.auth!;
    switch (prov) {
        case 'facebook':
            return new auth.FacebookAuthProvider();
        case 'github':
            return new auth.GithubAuthProvider();
        case 'google':
            return new auth.GoogleAuthProvider();
        case 'twitter':
            return new auth.TwitterAuthProvider();
    }
}

export async function requireAuth(): Promise<User | BackendUser | null> {
    if (isSelfHostedBackend) {
        // 1. Fast path: user info cached locally from prior session
        const cached = SelfHostedAuthData.load();
        if (cached) {
            return cached.user;
        }

        // 2. Cookie may exist from a prior session — ask the server who we are
        try {
            const { data: meUser } = await backendFunctions.getMe();
            if (meUser && meUser.uid) {
                SelfHostedAuthData.save(meUser);
                return meUser;
            }
        } catch {
            // Not authenticated yet — fall through to create anonymous session
        }

        // 3. Create a new anonymous session; server sets httpOnly cookie
        const { data } = await backendFunctions.anonymousAuth();
        SelfHostedAuthData.save(data.user);
        return data.user;
    }

    if (!firebase) {
        return null;
    }

    const auth = firebase.auth();

    if (auth.currentUser && auth.currentUser.uid) {
        return Promise.resolve(auth.currentUser);
    }

    return new Promise<User>(resolve => {
        const unsubscribe = auth.onAuthStateChanged(async user => {
            unsubscribe();

            if (user && user.uid) {
                resolve(user);
            } else {
                resolve((await auth.signInAnonymously()).user!);
            }
        });
    });
}
