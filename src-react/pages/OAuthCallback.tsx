import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/Spinner';

/**
 * The OAuth callback page. The auth saga handles the actual token exchange
 * by listening to LOCATION_CHANGED with pathname '/callback'. This component
 * just shows a loading spinner while that happens, then the saga redirects.
 */
export function OAuthCallback() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Spinner size={48} />
            <p className="text-white/60 text-sm">Completing sign in…</p>
        </div>
    );
}
