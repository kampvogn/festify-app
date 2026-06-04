import chunk from 'lodash-es/chunk';

import { Image, Metadata, PlayerDevice } from '../../state';
import { MusicProvider, SearchResult, WebPlayerHandle, WebPlaybackState } from '../music-provider';
import { requireAccessToken, requireAnonymousAuth, fetchWithAccessToken, fetchWithAnonymousAuth } from '../spotify-auth';

export class SpotifyProvider implements MusicProvider {
    readonly name = 'spotify';

    getUserToken(): Promise<string> {
        return requireAccessToken();
    }

    getClientToken(): Promise<string> {
        return requireAnonymousAuth();
    }

    async search(query: string, countryCode: string, limit = 10): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        let url: string | null =
            `/search?type=track&limit=${limit}` +
            `&q=${encodeURIComponent(query.replace('-', ' ').trim())}`;

        while (results.length < 20 && url) {
            const resp = await fetchWithAnonymousAuth(url);
            if (!resp.ok) {
                const body = await resp.text();
                throw new Error(`Spotify search failed with ${resp.status}: ${body}`);
            }

            const data: SpotifyApi.TrackSearchResponse = await resp.json();
            for (const track of data.tracks.items) {
                results.push(spotifyTrackToSearchResult(track));
            }
            url = data.tracks.next;
        }

        return results;
    }

    async getMetadata(ids: string[], countryCode: string): Promise<Record<string, Metadata>> {
        const result: Record<string, Metadata> = {};

        for (const batch of chunk(ids, 50)) {
            const responses: Response[] = await Promise.all(
                batch.map(id => fetchWithAnonymousAuth(`/tracks/${id}?market=${countryCode}`)),
            );
            const tracks: SpotifyApi.TrackObjectFull[] = await Promise.all(
                responses.map(r => r.json()),
            );
            for (const track of tracks) {
                result[`spotify-${track.id}`] = spotifyTrackToMetadata(track);
            }
        }

        return result;
    }

    async getDevices(): Promise<PlayerDevice[]> {
        const resp = await fetchWithAccessToken('/me/player/devices');
        if (!resp.ok) {
            const body = await resp.text();
            throw new Error(body || `Failed to load playback devices (${resp.status})`);
        }
        const data: SpotifyApi.UserDevicesResponse = await resp.json();
        return (data.devices || []).map(spotifyDeviceToPlayerDevice);
    }

    async transferPlayback(deviceId: string): Promise<void> {
        const resp = await fetchWithAccessToken('/me/player', {
            method: 'put',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
        if (!resp.ok) {
            const body = await resp.text();
            throw new Error(body || `Failed to transfer playback (${resp.status})`);
        }
    }

    async setVolume(volumePercent: number): Promise<void> {
        await fetchWithAccessToken(`/me/player/volume?volume_percent=${volumePercent}`, {
            method: 'put',
        });
    }

    async initWebPlayer(): Promise<WebPlayerHandle> {
        if (typeof Spotify === 'undefined') {
            throw new Error('Spotify Web Playback SDK is not loaded.');
        }

        const player = new Spotify.Player({
            name: 'Festify 🎉',
            getOAuthToken: (cb) => requireAccessToken().then(cb),
            volume: 1,
        });

        return new Promise((resolve, reject) => {
            const onReady = ({ device_id }: Spotify.WebPlaybackInstance) => {
                player.removeListener('ready' as any, onReady as any);
                resolve(new SpotifyWebPlayerHandle(player, device_id));
            };
            player.on('ready' as any, onReady as any);

            const onError = ({ message }: Spotify.Error) => reject(new Error(message));
            player.on('initialization_error', onError as any);
            player.on('authentication_error', onError as any);
            player.on('account_error', onError as any);

            player.connect();
        });
    }

    async play(deviceId: string, trackId: string, positionMs: number): Promise<void> {
        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({
            uris: [`spotify:track:${trackId}`],
            position_ms: Math.floor(positionMs),
        });
        const uri = `/me/player/play?device_id=${deviceId}`;

        let resp = await fetchWithAccessToken(uri, { method: 'put', headers, body });

        if (resp.status === 404) {
            await fetchWithAccessToken('/me/player', {
                method: 'put',
                headers,
                body: JSON.stringify({ device_ids: [deviceId], play: false }),
            });
            await new Promise(res => setTimeout(res, 500));
            resp = await fetchWithAccessToken(uri, { method: 'put', headers, body });
        }

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Spotify play failed (${resp.status}): ${text}`);
        }
    }
}

class SpotifyWebPlayerHandle implements WebPlayerHandle {
    readonly deviceId: string;
    private readonly player: Spotify.SpotifyPlayer;

    constructor(player: Spotify.SpotifyPlayer, deviceId: string) {
        this.player = player;
        this.deviceId = deviceId;
    }

    async getCurrentState(): Promise<WebPlaybackState | null> {
        const state = await this.player.getCurrentState();
        if (!state) return null;
        return {
            paused: state.paused,
            position: state.position,
            duration: state.duration,
            trackId: state.track_window.current_track.id || '',
        };
    }

    pause(): Promise<void> {
        return this.player.pause();
    }

    resume(): Promise<void> {
        return this.player.resume();
    }

    disconnect(): void {
        this.player.disconnect();
    }

    onStateChange(handler: (state: WebPlaybackState | null) => void): () => void {
        const listener = (state: Spotify.PlaybackState | null) => {
            if (!state) {
                handler(null);
                return;
            }
            handler({
                paused: state.paused,
                position: state.position,
                duration: state.duration,
                trackId: state.track_window.current_track.id || '',
            });
        };
        this.player.on('player_state_changed', listener as any);
        return () => this.player.removeListener('player_state_changed', listener as any);
    }

    onError(handler: (error: Error) => void): () => void {
        const errorEvents = [
            'initialization_error',
            'authentication_error',
            'account_error',
            'playback_error',
        ];

        const listener = ({ message }: Spotify.Error) => handler(new Error(message));
        errorEvents.forEach(ev => this.player.on(ev as any, listener as any));
        return () => errorEvents.forEach(ev => this.player.removeListener(ev as any, listener as any));
    }
}

function spotifyTrackToSearchResult(track: SpotifyApi.TrackObjectFull): SearchResult {
    return {
        id: track.id,
        provider: 'spotify',
        name: track.name,
        artists: track.artists.map(a => a.name),
        cover: (track.album.images as Image[]).filter(img => img.width && img.height),
        durationMs: track.duration_ms,
        isPlayable: track.is_playable !== false,
        isrc: track.external_ids ? track.external_ids.isrc : undefined,
        explicit: track.explicit,
    };
}

function spotifyTrackToMetadata(track: SpotifyApi.TrackObjectFull): Metadata {
    return {
        artists: track.artists.map(a => a.name),
        cover: (track.album.images as Image[]).filter(img => img.width && img.height),
        durationMs: track.duration_ms,
        isrc: track.external_ids ? track.external_ids.isrc : undefined,
        isPlayable: track.is_playable !== false,
        name: track.name,
    };
}

function spotifyDeviceToPlayerDevice(device: SpotifyApi.UserDevice): PlayerDevice {
    return {
        id: device.id,
        name: device.name,
        type: device.type || null,
        is_active: device.is_active,
        volume_percent: device.volume_percent != null ? device.volume_percent : null,
    };
}

export const spotifyProvider = new SpotifyProvider();
