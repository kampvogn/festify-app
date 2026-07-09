import { Link } from 'react-router-dom';
import { queueTracksSelector } from '../../src/selectors/track';
import { isPartyOwnerSelector } from '../../src/selectors/party';
import { settingsRouteSelector } from '../../src/selectors/routes';
import { useAppSelector } from '../hooks/useAppDispatch';
import { PartyTrack } from './PartyTrack';
import { Spinner } from './Spinner';

export function PartyQueue() {
    const hasTracksLoaded = useAppSelector(s => s.party.hasTracksLoaded);
    const isOwner = useAppSelector(isPartyOwnerSelector);
    const settingsRoute = useAppSelector(settingsRouteSelector);
    const tracks = useAppSelector(queueTracksSelector);

    if (!hasTracksLoaded) {
        return (
            <div className="flex justify-center mt-8">
                <Spinner size={40} />
            </div>
        );
    }

    if (tracks.length === 0) {
        return (
            <div className="text-center mx-4 mt-8">
                <h2 className="text-xl font-light">🌝 The queue is empty!</h2>
                <h3 className="text-base font-light text-white/70">
                    {isOwner ? (
                        <>
                            <Link to={settingsRoute || '#'} className="text-[#951518] underline">
                                Go to settings
                            </Link>{' '}
                            to add a fallback playlist
                        </>
                    ) : (
                        'Search for your favourite tracks and add them to the queue'
                    )}
                </h3>
            </div>
        );
    }

    return (
        <div className="bg-[#22262b]">
            {tracks.map((track, i) => {
                const id = `${track.reference.provider}-${track.reference.id}`;
                return (
                    <div
                        key={id}
                        className={i % 2 === 0 ? 'bg-[#22262b]' : 'bg-[#25292e]'}
                    >
                        <PartyTrack trackId={id} isFirstInQueue={i === 0} />
                    </div>
                );
            })}
        </div>
    );
}
