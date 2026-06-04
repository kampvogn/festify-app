import { MusicProvider } from './music-provider';
import { spotifyProvider } from './providers/spotify-provider';

const registry = new Map<string, MusicProvider>();
registry.set(spotifyProvider.name, spotifyProvider);

export function registerProvider(provider: MusicProvider): void {
    registry.set(provider.name, provider);
}

export function getProvider(name: string): MusicProvider {
    const provider = registry.get(name);
    if (!provider) {
        throw new Error(`Music provider '${name}' is not registered.`);
    }
    return provider;
}
