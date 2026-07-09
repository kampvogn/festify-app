import { triggerOAuthLogin } from '../../src/actions/auth';
import {
    changePartyName,
    changePartySetting,
    changeSearchInput,
    flushQueueStart,
    insertPlaylistStart,
} from '../../src/actions/view-party-settings';
import { filteredPlaylistsSelector } from '../../src/selectors/playlists';
import { hasConnectedSpotifyAccountSelector } from '../../src/selectors/users';
import { PartySettings as PartySettingsState, Playlist } from '../../src/state';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { Spinner } from './Spinner';
import { AddIcon } from './Icons';

function SettingRow({ label, checked, onChange, title }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    title?: string;
}) {
    return (
        <label className="flex items-center gap-3 py-2 cursor-pointer" title={title}>
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className="w-4 h-4 accent-[#951518]"
            />
            <span className="text-sm text-white/80">{label}</span>
        </label>
    );
}

function PlaylistRow({ item, onInsert, onShuffle, disabled }: {
    item: Playlist;
    onInsert: () => void;
    onShuffle: () => void;
    disabled: boolean;
}) {
    return (
        <div className="flex items-center gap-2 py-1 hover:bg-white/10 px-2 rounded">
            <span className="flex-1 text-sm truncate">{item.name}</span>
            <button
                onClick={onShuffle}
                disabled={disabled}
                title="Insert shuffled"
                className="p-1 text-white/60 hover:text-white disabled:opacity-40 transition-colors"
            >
                🔀
            </button>
            <button
                onClick={onInsert}
                disabled={disabled}
                title="Insert"
                className="p-1 text-white/60 hover:text-white disabled:opacity-40 transition-colors"
            >
                <AddIcon size={18} />
            </button>
        </div>
    );
}

export function PartySettings() {
    const dispatch = useAppDispatch();

    const isAuthorizing = useAppSelector(s => s.user.credentials.spotify.authorizing);
    const isPlaylistLoadInProgress = useAppSelector(s => s.settingsView.playlistLoadInProgress);
    const isSpotifyConnected = useAppSelector(hasConnectedSpotifyAccountSelector);
    const partyName = useAppSelector(s => s.party.currentParty?.name ?? '');
    const playlists = useAppSelector(filteredPlaylistsSelector);
    const playlistSearch = useAppSelector(s => s.settingsView.playlistSearchQuery);
    const queueFlushInProgress = useAppSelector(s => s.settingsView.queueFlushInProgress);
    const settings = useAppSelector(s =>
        PartySettingsState.defaultSettings(s.party.currentParty?.settings),
    );
    const tracksLoadInProgress = useAppSelector(s => s.settingsView.tracksLoadInProgress);
    const tracksLoaded = useAppSelector(s => s.settingsView.tracksLoaded);
    const tracksToLoad = useAppSelector(s => s.settingsView.tracksToLoad);

    function setSetting<K extends keyof PartySettingsState>(k: K, v: PartySettingsState[K]) {
        dispatch(changePartySetting(k, v));
    }

    return (
        <div className="flex flex-col lg:flex-row px-0">
            {/* General settings */}
            <div className="lg:w-1/2 px-5 py-2.5">
                <h3 className="text-base font-medium border-b border-[#333] pb-1 mb-3">General Settings</h3>

                <div className="mb-4">
                    <label className="block text-xs text-white/50 mb-1">Party Name</label>
                    <input
                        type="text"
                        value={partyName}
                        onChange={e => dispatch(changePartyName(e.target.value))}
                        className="w-full bg-transparent border-b border-white/30 focus:border-[#951518] text-white text-sm py-1 outline-none transition-colors"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-xs text-white/50 mb-1">Maximum Track Length (minutes)</label>
                    <input
                        type="number"
                        min="1"
                        value={settings.maximum_track_length ?? ''}
                        onChange={e => setSetting('maximum_track_length', parseInt(e.target.value) || null)}
                        className="w-full bg-transparent border-b border-white/30 focus:border-[#951518] text-white text-sm py-1 outline-none transition-colors"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-xs text-white/50 mb-1">TV Mode Text</label>
                    <input
                        type="text"
                        value={settings.tv_mode_text}
                        onChange={e => setSetting('tv_mode_text', e.target.value)}
                        className="w-full bg-transparent border-b border-white/30 focus:border-[#951518] text-white text-sm py-1 outline-none transition-colors"
                    />
                </div>

                <SettingRow
                    label="Close search after a track has been added"
                    checked={!settings.allow_multi_track_add}
                    onChange={v => setSetting('allow_multi_track_add', !v)}
                    title="Prevent users from adding lots of tracks quickly"
                />
                <SettingRow
                    label="Allow guests to add explicit tracks"
                    checked={settings.allow_explicit_tracks}
                    onChange={v => setSetting('allow_explicit_tracks', v)}
                />
                <SettingRow
                    label="Require guests to sign in before voting"
                    checked={!settings.allow_anonymous_voters}
                    onChange={v => setSetting('allow_anonymous_voters', !v)}
                />

                <button
                    onClick={() => dispatch(flushQueueStart())}
                    disabled={queueFlushInProgress}
                    className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded disabled:opacity-50 transition-colors"
                >
                    {queueFlushInProgress ? 'Flushing...' : 'Flush queue'}
                </button>
            </div>

            {/* Fallback playlist */}
            <div className="lg:w-1/2 px-5 py-2.5">
                <h3 className="text-base font-medium border-b border-[#333] pb-1 mb-3">Fallback Playlist</h3>

                {!isSpotifyConnected ? (
                    <div>
                        <p className="text-sm text-white/60 mb-3">Sign in to set the Fallback Playlist</p>
                        {isAuthorizing ? (
                            <Spinner size={32} />
                        ) : (
                            <button
                                onClick={() => dispatch(triggerOAuthLogin('spotify'))}
                                className="px-4 py-2 bg-[#1DB954] text-white text-sm font-medium rounded hover:bg-[#1aa34a] transition-colors"
                            >
                                Sign in with Spotify
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Search your playlists"
                            value={playlistSearch}
                            onChange={e => dispatch(changeSearchInput(e.target.value))}
                            className="w-full bg-transparent border-b border-white/30 focus:border-[#951518] text-white text-sm py-1 outline-none mb-3 transition-colors"
                        />
                        {isPlaylistLoadInProgress && (
                            <div className="flex justify-center my-4">
                                <Spinner size={32} />
                            </div>
                        )}
                        {tracksLoadInProgress && (
                            <p className="text-sm text-white/60 my-2">
                                Loading tracks… {tracksLoaded}/{tracksToLoad}
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {playlists.map(pl => (
                                <PlaylistRow
                                    key={`${pl.reference.provider}-${pl.reference.userId}-${pl.reference.id}`}
                                    item={pl}
                                    disabled={tracksLoadInProgress}
                                    onInsert={() => dispatch(insertPlaylistStart(pl, false))}
                                    onShuffle={() => dispatch(insertPlaylistStart(pl, true))}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
