import {
    loadPlaybackDevicesStart,
    selectPlaybackDevice,
    setVolume,
    transferPlaybackDeviceStart,
} from '../../src/actions/playback-spotify';
import { isPartyOwnerSelector } from '../../src/selectors/party';
import { hasConnectedSpotifyAccountSelector } from '../../src/selectors/users';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { Spinner } from './Spinner';

export function PlaybackDevicePicker() {
    const dispatch = useAppDispatch();
    const isOwner = useAppSelector(isPartyOwnerSelector);
    const isSpotifyConnected = useAppSelector(hasConnectedSpotifyAccountSelector);
    const devices = useAppSelector(s => s.player.availableDevices);
    const deviceLoadInProgress = useAppSelector(s => s.player.deviceLoadInProgress);
    const deviceLoadError = useAppSelector(s => s.player.deviceLoadError);
    const selectedDeviceId = useAppSelector(s => s.player.selectedDeviceId);
    const transferPlaybackInProgress = useAppSelector(s => s.player.transferPlaybackInProgress);
    const volume = useAppSelector(s => s.player.volume);

    if (!isOwner || !isSpotifyConnected) return null;

    return (
        <div className="px-2 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
                <label htmlFor="playback-device" className="text-xs text-white/70 uppercase tracking-wide">
                    Playback device
                </label>
                <select
                    id="playback-device"
                    value={selectedDeviceId || ''}
                    onChange={e => dispatch(selectPlaybackDevice(e.target.value || null))}
                    className="flex-1 min-w-0 bg-[#1d2126] border border-white/15 rounded text-white text-sm px-2.5 py-2"
                >
                    <option value="">Choose device</option>
                    {devices.map(d => (
                        <option key={d.id} value={d.id ?? ''}>
                            {d.name}{d.is_active ? ' (active)' : ''}{d.type ? ` - ${d.type}` : ''}
                        </option>
                    ))}
                </select>
                <button
                    onClick={() => dispatch(loadPlaybackDevicesStart())}
                    className="text-sm px-3 py-2 border border-white/15 text-white rounded hover:bg-white/10 transition-colors"
                >
                    Reload
                </button>
                <button
                    onClick={() => dispatch(transferPlaybackDeviceStart())}
                    disabled={!selectedDeviceId || transferPlaybackInProgress}
                    className="text-sm px-3 py-2 bg-[#951518] text-white rounded disabled:opacity-50 hover:bg-[#731417] transition-colors flex items-center gap-2"
                >
                    {transferPlaybackInProgress && <Spinner size={16} />}
                    Transfer
                </button>
            </div>
            {deviceLoadInProgress && (
                <div className="mt-1 text-xs text-white/60">Loading devices…</div>
            )}
            {deviceLoadError && (
                <div className="mt-1 text-xs text-red-400">{deviceLoadError.message}</div>
            )}
            <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-white/70 whitespace-nowrap">Volume</label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={e => dispatch(setVolume(Number(e.target.value)))}
                    className="flex-1 accent-[#951518]"
                />
            </div>
        </div>
    );
}
