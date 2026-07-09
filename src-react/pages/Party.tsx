import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { triggerOAuthLogin } from '../../src/actions/auth';
import { changeDisplayLoginModal } from '../../src/actions/view-party';
import { queueDragDrop, queueDragEnter, queueDragOver } from '../../src/actions';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { SearchBar } from '../components/SearchBar';
import { PlaybackProgressBar } from '../components/PlaybackProgressBar';
import { PlaybackDevicePicker } from '../components/PlaybackDevicePicker';
import { PartyQueue } from '../components/PartyQueue';
import { PartySearch } from '../components/PartySearch';
import { PartySettings } from '../components/PartySettings';
import { PartyShare } from '../components/PartyShare';
import { QueueDrawer } from '../components/QueueDrawer';
import { MenuIcon } from '../components/Icons';

export function Party() {
    const dispatch = useAppDispatch();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const partyName = useAppSelector(s => s.party.currentParty?.name ?? '');
    const displayLoginModal = useAppSelector(s => s.partyView.loginModalOpen);

    return (
        <div className="flex min-h-screen bg-[#1c1f24]">
            {/* Drawer overlay on mobile */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-10 md:hidden"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Side drawer */}
            <aside
                className={`fixed md:static top-0 left-0 h-full w-64 z-20 transform transition-transform duration-200
                    ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
            >
                <QueueDrawer />
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Fixed header */}
                <header className="fixed top-0 left-0 right-0 md:left-64 bg-[#212121] z-10">
                    <div className="flex items-center h-12 px-2">
                        <button
                            className="md:hidden p-3 text-white hover:text-white/70 transition-colors"
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open menu"
                        >
                            <MenuIcon size={24} />
                        </button>
                        <div className="flex-1 text-center text-base font-medium pr-12 md:pr-0">
                            {partyName}
                        </div>
                    </div>
                    <div className="px-2">
                        <SearchBar />
                    </div>
                    <PlaybackDevicePicker />
                    <div className="relative">
                        <PlaybackProgressBar />
                    </div>
                </header>

                {/* Page content — padded to account for fixed header */}
                <main
                    className="pt-[220px]"
                    onDragEnter={e => dispatch(queueDragEnter(e.nativeEvent as DragEvent))}
                    onDragOver={e => { e.preventDefault(); dispatch(queueDragOver(e.nativeEvent as DragEvent)); }}
                    onDrop={e => dispatch(queueDragDrop(e.nativeEvent as DragEvent))}
                >
                    <Routes>
                        <Route index element={<PartyQueue />} />
                        <Route path="search" element={<PartySearch />} />
                        <Route path="settings" element={<PartySettings />} />
                        <Route path="share" element={<PartyShare />} />
                    </Routes>
                </main>
            </div>

            {/* Login modal */}
            {displayLoginModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1c1f24] rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <h2 className="text-lg font-medium mb-3">Please sign in to vote</h2>
                        <p className="text-sm text-white/60 mb-4">
                            The party owner requires all guests to sign in to prevent cheating,
                            but you wouldn't do that anyway, would ya? 😛
                        </p>
                        <button
                            onClick={() => dispatch(triggerOAuthLogin('spotify'))}
                            className="w-full py-2.5 bg-[#1DB954] text-white text-sm font-medium rounded hover:bg-[#1aa34a] transition-colors mb-2"
                        >
                            Sign in with Spotify
                        </button>
                        <button
                            onClick={() => dispatch(changeDisplayLoginModal(false))}
                            className="w-full py-2 text-white/60 hover:text-white text-sm transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
