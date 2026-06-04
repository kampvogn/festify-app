import { Image, Metadata, PlayerDevice } from '../state';

export interface SearchResult {
    id: string;
    provider: string;
    name: string;
    artists: string[];
    cover: Image[];
    durationMs: number;
    isPlayable: boolean;
    isrc?: string;
    explicit: boolean;
}

export interface WebPlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    trackId: string;
}

export interface WebPlayerHandle {
    deviceId: string;
    getCurrentState(): Promise<WebPlaybackState | null>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    disconnect(): void;
    onStateChange(handler: (state: WebPlaybackState | null) => void): () => void;
    onError(handler: (error: Error) => void): () => void;
}

export interface MusicProvider {
    readonly name: string;

    getUserToken(): Promise<string>;
    getClientToken(): Promise<string>;

    search(query: string, countryCode: string, limit?: number): Promise<SearchResult[]>;
    getMetadata(ids: string[], countryCode: string): Promise<Record<string, Metadata>>;

    getDevices(): Promise<PlayerDevice[]>;
    transferPlayback(deviceId: string): Promise<void>;
    setVolume(volumePercent: number): Promise<void>;

    initWebPlayer(): Promise<WebPlayerHandle>;
    play(deviceId: string, trackId: string, positionMs: number): Promise<void>;
}
