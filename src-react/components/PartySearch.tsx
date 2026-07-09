import { sortedTracksFactory } from '../../src/selectors/track';
import { State, AlbumSearchResult, PlaylistSearchResult } from '../../src/state';
import { triggerDrillDown } from '../../src/actions/view-party';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { PartyTrack } from './PartyTrack';
import { DrillDown } from './DrillDown';
import { Spinner } from './Spinner';
import { TrackCover } from './TrackCover';
import { ChevronRightIcon, AlbumIcon, PlaylistIcon } from './Icons';

const tracksSelector = (s: State) => s.partyView.searchResult;
const sortedResultSelector = sortedTracksFactory(tracksSelector);

export function SectionHeader({ label }: { label: string }) {
    return (
        <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/40 bg-[#1c1f24]">
            {label}
        </div>
    );
}

function AlbumRow({ album }: { album: AlbumSearchResult }) {
    const dispatch = useAppDispatch();
    return (
        <button
            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            onClick={() => dispatch(triggerDrillDown(album.id, 'album', album.name))}
        >
            {album.cover.length > 0 ? (
                <TrackCover images={album.cover} size={48} />
            ) : (
                <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white/10 rounded">
                    <AlbumIcon size={24} className="text-white/40" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{album.name}</div>
                <div className="text-xs text-white/50 truncate">
                    {album.artists.join(', ')}{album.releaseYear ? ` · ${album.releaseYear}` : ''}
                    {album.totalTracks ? ` · ${album.totalTracks} tracks` : ''}
                </div>
            </div>
            <ChevronRightIcon size={20} className="text-white/30 shrink-0" />
        </button>
    );
}

function PlaylistRow({ playlist }: { playlist: PlaylistSearchResult }) {
    const dispatch = useAppDispatch();
    return (
        <button
            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            onClick={() => dispatch(triggerDrillDown(playlist.id, 'playlist', playlist.name))}
        >
            {playlist.cover.length > 0 ? (
                <TrackCover images={playlist.cover} size={48} />
            ) : (
                <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white/10 rounded">
                    <PlaylistIcon size={24} className="text-white/40" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{playlist.name}</div>
                <div className="text-xs text-white/50 truncate">
                    {playlist.owner}{playlist.totalTracks ? ` · ${playlist.totalTracks} tracks` : ''}
                </div>
            </div>
            <ChevronRightIcon size={20} className="text-white/30 shrink-0" />
        </button>
    );
}

export function PartySearch() {
    const searchInProgress = useAppSelector(s => s.partyView.searchInProgress);
    const searchError = useAppSelector(s => s.partyView.searchError);
    const tracks = useAppSelector(sortedResultSelector);
    const albums = useAppSelector(s => s.partyView.searchAlbums ?? []);
    const playlists = useAppSelector(s => s.partyView.searchPlaylists ?? []);
    const hasDrillDown = useAppSelector(
        s => s.partyView.drillDown !== null || s.partyView.drillDownInProgress,
    );

    return (
        <>
            {/* Drill-down overlay */}
            {hasDrillDown && <DrillDown />}

            {/* Search results */}
            {searchInProgress && (
                <div className="flex flex-col items-center mt-8 gap-4">
                    <Spinner size={40} />
                </div>
            )}

            {searchError && !searchInProgress && (
                <div className="flex flex-col items-center text-center mt-8 mx-8">
                    <h2 className="text-xl">⚡️ Oh, no!</h2>
                    <h3 className="text-base font-light text-white/70">
                        An error occurred while searching. Please try again.
                    </h3>
                </div>
            )}

            {!searchInProgress && !searchError && (tracks.length > 0 || albums.length > 0 || playlists.length > 0) && (
                <div className="pt-2">
                    {tracks.length > 0 && (
                        <>
                            <SectionHeader label="Tracks" />
                            {tracks.map((track, i) => {
                                const id = `${track.reference.provider}-${track.reference.id}`;
                                return (
                                    <div key={id} className={i % 2 === 0 ? 'bg-[#22262b]' : 'bg-[#25292e]'}>
                                        <PartyTrack trackId={id} />
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {albums.length > 0 && (
                        <>
                            <SectionHeader label="Albums" />
                            {albums.map((album, i) => (
                                <div key={`${album.provider}-${album.id}`} className={i % 2 === 0 ? 'bg-[#22262b]' : 'bg-[#25292e]'}>
                                    <AlbumRow album={album} />
                                </div>
                            ))}
                        </>
                    )}

                    {playlists.length > 0 && (
                        <>
                            <SectionHeader label="Playlists" />
                            {playlists.map((pl, i) => (
                                <div key={`${pl.provider}-${pl.id}`} className={i % 2 === 0 ? 'bg-[#22262b]' : 'bg-[#25292e]'}>
                                    <PlaylistRow playlist={pl} />
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
