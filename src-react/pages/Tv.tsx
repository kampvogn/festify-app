import { createSelector } from 'reselect';
import { artistJoinerFactory, currentTrackIdSelector, queueTracksSelector, singleMetadataSelector } from '../../src/selectors/track';
import { Metadata, State } from '../../src/state';
import { useAppSelector } from '../hooks/useAppDispatch';
import { TrackCover } from '../components/TrackCover';
import { FestifyLogo } from '../components/FestifyLogo';
import { Spinner } from '../components/Spinner';

const artistJoiner = artistJoinerFactory();

const mapStateToProps = (s: State) => {
    const currentTrackId = currentTrackIdSelector(s);
    const currentTrackMetadata = currentTrackId ? singleMetadataSelector(s, currentTrackId) : null;
    const queueTracks = queueTracksSelector(s);
    return {
        currentTrackId,
        currentTrackMetadata,
        currentTrackArtistName: currentTrackId ? artistJoiner(s, currentTrackId) : null,
        text: s.party.currentParty?.settings?.tv_mode_text ?? '',
        hasTracks: queueTracks.length > 0,
        isLoading: s.player.initializing,
        initError: s.player.initializationError,
        metadata: s.metadata,
        party: s.party.currentParty,
        queueTracks,
    };
};

export function Tv() {
    const props = useAppSelector(mapStateToProps);

    if (props.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size={48} />
            </div>
        );
    }

    if (props.initError) {
        return (
            <div className="flex items-center justify-center min-h-screen text-center p-8">
                <div>
                    <h2 className="text-xl mb-2">⚡️ Playback Error</h2>
                    <p className="text-white/60">{props.initError.message}</p>
                </div>
            </div>
        );
    }

    if (!props.hasTracks || !props.currentTrackMetadata) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-6">
                <FestifyLogo size={120} />
                <p className="text-xl text-white/60">{props.text || 'Waiting for tracks...'}</p>
            </div>
        );
    }

    const meta = props.currentTrackMetadata;
    const nextTracks = props.queueTracks.slice(1, 4);

    return (
        <div className="flex flex-col min-h-screen overflow-hidden">
            {/* Background art */}
            <div className="relative flex-1">
                {meta.cover.length > 0 && (
                    <div className="absolute inset-0">
                        <img
                            src={meta.cover[0]?.url}
                            alt=""
                            className="w-full h-full object-cover blur-xl opacity-30 scale-110"
                        />
                    </div>
                )}
                <div className="relative flex items-center justify-center h-full min-h-[50vh] gap-8 p-8">
                    <TrackCover images={meta.cover} size={200} />
                    <div>
                        <h1 className="text-4xl font-light mb-2">{meta.name}</h1>
                        <p className="text-xl text-white/70">{props.currentTrackArtistName}</p>
                    </div>
                </div>
            </div>

            {/* Queue preview */}
            <div className="bg-black/40 px-8 py-4">
                <div className="flex gap-8 mb-3">
                    {nextTracks.map(t => {
                        const id = `${t.reference.provider}-${t.reference.id}`;
                        const m = props.metadata[id];
                        if (!m) return null;
                        return (
                            <div key={id} className="flex items-center gap-3">
                                <TrackCover images={m.cover} size={48} />
                                <div>
                                    <div className="text-sm font-medium truncate max-w-[160px]">{m.name}</div>
                                    <div className="text-xs text-white/50">{m.artists?.[0]}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-xs text-white/40 text-center">{props.text}</p>
            </div>
        </div>
    );
}
