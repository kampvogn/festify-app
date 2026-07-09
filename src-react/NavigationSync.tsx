import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from './hooks/useAppDispatch';
import { locationChanged, parseLocation } from './routing-bridge';

/**
 * Syncs React Router navigation into Redux so existing sagas receive
 * LOCATION_CHANGED actions in the shape they expect.
 */
export function NavigationSync() {
    const location = useLocation();
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(locationChanged(parseLocation(location.pathname, location.search)));
    }, [location.pathname, location.search, dispatch]);

    return null;
}
