import { NavLink } from 'react-router-dom';
import { logout, triggerOAuthLogin } from '../../src/actions/auth';
import { toggleUserMenu } from '../../src/actions/view-queue-drawer';
import { isPartyOwnerSelector } from '../../src/selectors/party';
import {
    queueRouteSelector,
    settingsRouteSelector,
    shareRouteSelector,
    tvRouteSelector,
} from '../../src/selectors/routes';
import { currentUsernameSelector } from '../../src/selectors/users';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { FestifyLogo } from './FestifyLogo';
import { SettingsIcon, ShareIcon } from './Icons';

export function QueueDrawer() {
    const dispatch = useAppDispatch();
    const isOwner = useAppSelector(isPartyOwnerSelector);
    const queueRoute = useAppSelector(queueRouteSelector);
    const settingsRoute = useAppSelector(settingsRouteSelector);
    const shareRoute = useAppSelector(shareRouteSelector);
    const tvRoute = useAppSelector(tvRouteSelector);
    const userMenuOpen = useAppSelector(s => s.partyView.userMenuOpen);
    const username = currentUsernameSelector();

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
            isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
        }`;

    return (
        <div className="flex flex-col min-h-screen bg-[#1c1f24] text-white">
            <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
                <FestifyLogo size={40} />
                <span className="text-base font-medium">Festify</span>
            </div>

            <nav className="flex-1 py-2">
                {queueRoute && (
                    <NavLink to={queueRoute} className={linkClass} end>
                        Queue
                    </NavLink>
                )}
                {isOwner && settingsRoute && (
                    <NavLink to={settingsRoute} className={linkClass}>
                        <SettingsIcon size={20} />
                        Settings
                    </NavLink>
                )}
                {shareRoute && (
                    <NavLink to={shareRoute} className={linkClass}>
                        <ShareIcon size={20} />
                        Share
                    </NavLink>
                )}
                {isOwner && tvRoute && (
                    <a href={tvRoute} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                        TV Mode
                    </a>
                )}
            </nav>

            <div className="border-t border-white/10 p-4">
                <button
                    className="w-full text-left text-sm text-white/60 hover:text-white transition-colors"
                    onClick={() => dispatch(toggleUserMenu())}
                >
                    {username || 'Guest'}
                </button>
                {userMenuOpen && (
                    <div className="mt-2 space-y-1">
                        {!username && (
                            <button
                                className="w-full text-left text-sm px-2 py-1 text-white/60 hover:text-white transition-colors"
                                onClick={() => dispatch(triggerOAuthLogin('spotify'))}
                            >
                                Sign in with Spotify
                            </button>
                        )}
                        {username && (
                            <button
                                className="w-full text-left text-sm px-2 py-1 text-white/60 hover:text-white transition-colors"
                                onClick={() => dispatch(logout())}
                            >
                                Sign out
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
