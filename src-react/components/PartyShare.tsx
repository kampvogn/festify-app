import { shareParty } from '../../src/actions/view-party-share';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';

export function PartyShare() {
    const dispatch = useAppDispatch();
    const partyId = useAppSelector(s => s.party.currentParty?.short_id ?? '');
    const domain = window.location.host;
    const hasShareApi = typeof (navigator as any).share === 'function';

    return (
        <div className="px-5 py-2.5">
            <p className="text-xl text-white/80">
                Add new songs to the queue by searching for them or ask your guests to go to{' '}
                <span className="underline whitespace-nowrap">{domain}</span> and enter this code:
            </p>
            <div className="text-[32px] text-center my-4 select-text tracking-widest font-light">
                {partyId}
            </div>
            {hasShareApi && (
                <button
                    onClick={() => dispatch(shareParty())}
                    className="px-4 py-2 bg-[#951518] text-white text-sm rounded hover:bg-[#731417] transition-colors"
                >
                    Share
                </button>
            )}
        </div>
    );
}
