import { State } from '../state';
import { currentAuthUser } from '../util/auth';
import { LOCALSTORAGE_KEY } from '../util/spotify-auth';

export const currentUsernameSelector = () => {
    const user = currentAuthUser();
    return user ? user.displayName || user.email || '' : null;
};

export const hasConnectedSpotifyAccountSelector = (s: State) =>
    Boolean(s.user.credentials.spotify.user || localStorage[LOCALSTORAGE_KEY]);
