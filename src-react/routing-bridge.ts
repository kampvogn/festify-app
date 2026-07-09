/**
 * Bridges React Router navigation to the Redux action shape that the existing
 * sagas expect from @festify/redux-little-router.
 */
import { Views, PartyViews } from '../src/routing';

export const LOCATION_CHANGED = 'LOCATION_CHANGED';

export interface RouterLocation {
    pathname: string;
    query: Record<string, string>;
    params: Record<string, string>;
    result: {
        view?: Views;
        subView?: PartyViews;
        title?: string;
    };
}

const defaultLocation: RouterLocation = {
    pathname: '/',
    query: {},
    params: {},
    result: { view: Views.Home, title: 'Home' },
};

export function routerReducer(
    state: RouterLocation = defaultLocation,
    action: { type: string; payload?: RouterLocation },
): RouterLocation {
    if (action.type === LOCATION_CHANGED && action.payload) {
        return action.payload;
    }
    return state;
}

export function locationChanged(location: RouterLocation) {
    return { type: LOCATION_CHANGED as typeof LOCATION_CHANGED, payload: location };
}

/**
 * Parse a URL into the redux-little-router-compatible location shape.
 * Called by NavigationSync whenever React Router detects a navigation.
 */
export function parseLocation(pathname: string, search: string): RouterLocation {
    const query = Object.fromEntries(new URLSearchParams(search).entries());

    // /party/:partyId/search
    let match = pathname.match(/^\/party\/([^/]+)\/search$/);
    if (match) {
        return {
            pathname,
            query,
            params: { partyId: match[1] },
            result: { view: Views.Party, subView: PartyViews.Search, title: 'Search' },
        };
    }

    // /party/:partyId/settings
    match = pathname.match(/^\/party\/([^/]+)\/settings$/);
    if (match) {
        return {
            pathname,
            query,
            params: { partyId: match[1] },
            result: { view: Views.Party, subView: PartyViews.Settings, title: 'Party Settings' },
        };
    }

    // /party/:partyId/share
    match = pathname.match(/^\/party\/([^/]+)\/share$/);
    if (match) {
        return {
            pathname,
            query,
            params: { partyId: match[1] },
            result: { view: Views.Party, subView: PartyViews.Share, title: 'Share Party' },
        };
    }

    // /party/:partyId
    match = pathname.match(/^\/party\/([^/]+)$/);
    if (match) {
        return {
            pathname,
            query,
            params: { partyId: match[1] },
            result: { view: Views.Party, subView: PartyViews.Queue, title: 'Party' },
        };
    }

    // /tv/:partyId
    match = pathname.match(/^\/tv\/([^/]+)$/);
    if (match) {
        return {
            pathname,
            query,
            params: { partyId: match[1] },
            result: { view: Views.Tv, title: 'TV Mode' },
        };
    }

    // /callback
    if (pathname === '/callback') {
        return { pathname, query, params: {}, result: { view: Views.Home, title: 'Callback' } };
    }

    // /
    return { pathname, query, params: {}, result: { view: Views.Home, title: 'Home' } };
}
