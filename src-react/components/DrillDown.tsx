import { closeDrillDown } from '../../src/actions/view-party';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { PartyTrack } from './PartyTrack';
import { Spinner } from './Spinner';
import { ArrowBackIcon } from './Icons';
import { sortedTracksFactory } from '../../src/selectors/track';
import { State } from '../../src/state';

const drillDownTracksSelector = sortedTracksFactory((s: State) =>
    s.partyView.drillDown ? s.partyView.drillDown.tracks : null,
);

export function DrillDown() {
    const dispatch = useAppDispatch();
    const drillDown = useAppSelector(s => s.partyView.drillDown);
    const drillDownInProgress = useAppSelector(s => s.partyView.drillDownInProgress);
    const drillDownError = useAppSelector(s => s.partyView.drillDownError);
    const tracks = useAppSelector(drillDownTracksSelector);

    if (!drillDown && !drillDownInProgress && !drillDownError) return null;

    return (
        <div className="fixed inset-0 bg-[#1c1f24] z-30 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#212121] shrink-0">
                <button
                    onClick={() => dispatch(closeDrillDown())}
                    className="p-1.5 text-white hover:text-white/70 transition-colors"
                    aria-label="Back"
                >
                    <ArrowBackIcon size={24} />
                </button>
                <h2 className="text-base font-medium truncate">
                    {drillDown?.name ?? ''}
                </h2>
                <span className="text-xs text-white/40 shrink-0 capitalize">
                    {drillDown?.type}
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {drillDownInProgress && (
                    <div className="flex justify-center mt-8">
                        <Spinner size={40} />
                    </div>
                )}
                {drillDownError && (
                    <div className="text-center mt-8 mx-8">
                        <h3 className="text-base font-light text-white/70">
                            Could not load tracks. Please try again.
                        </h3>
                    </div>
                )}
                {!drillDownInProgress && !drillDownError && (
                    <>
                        {tracks.length === 0 && (
                            <p className="text-center mt-8 text-white/50 text-sm">No tracks found.</p>
                        )}
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
            </div>
        </div>
    );
}
