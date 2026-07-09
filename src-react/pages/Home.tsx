import { useState } from 'react';
import { triggerOAuthLogin } from '../../src/actions/auth';
import { createPartyStart, joinPartyStart } from '../../src/actions/party-data';
import {
    changePartyId,
    changeCreatePartyName,
    showCreatePartyForm,
    hideCreatePartyForm,
    endPartyStart,
    renamePartyStart,
} from '../../src/actions/view-home';
import { MyParty } from '../../src/state';
import { currentAuthUser } from '../../src/util/auth';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { FestifyLogo } from '../components/FestifyLogo';
import { Spinner } from '../components/Spinner';

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PartyRow({ p, onEnd }: { p: MyParty; onEnd: () => void }) {
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(p.name);
    const dispatch = useAppDispatch();

    function commitRename() {
        if (name.trim() && name.trim() !== p.name) {
            dispatch(renamePartyStart(p.id, name.trim()));
        }
        setRenaming(false);
    }

    return (
        <div className="flex items-center justify-between py-1.5 border-b border-white/10">
            <div className="flex flex-col items-start text-left">
                {renaming ? (
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && name.trim()) commitRename();
                            if (e.key === 'Escape') { setName(p.name); setRenaming(false); }
                        }}
                        onBlur={commitRename}
                        className="bg-transparent border-b border-white/50 text-white text-base font-medium outline-none w-40"
                    />
                ) : (
                    <span
                        className="text-base font-medium cursor-pointer hover:underline underline-offset-2"
                        title="Click to rename"
                        onClick={() => setRenaming(true)}
                    >
                        {p.name}
                    </span>
                )}
                <span className="text-[13px] opacity-60">#{p.short_id} · {formatDate(p.created_at)}</span>
            </div>
            <div className="flex gap-1 ml-2">
                <button
                    onClick={() => window.location.href = `/party/${p.id}`}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition-colors"
                >
                    Enter
                </button>
                <button
                    onClick={onEnd}
                    className="px-3 py-1.5 text-white/60 hover:text-white text-sm transition-colors"
                >
                    End
                </button>
            </div>
        </div>
    );
}

export function Home() {
    const dispatch = useAppDispatch();
    const {
        partyId,
        partyIdValid,
        partyJoinInProgress,
        partyCreationInProgress,
        myParties,
        myPartiesLoading,
        createPartyName,
        showCreateForm,
    } = useAppSelector(s => s.homeView);

    const isAuthorizing = useAppSelector(s => s.user.credentials.spotify.authorizing);
    const playerCompatible = useAppSelector(s => s.player.isCompatible);
    const authStatusKnown = useAppSelector(s => s.user.credentials.spotify.statusKnown);
    const backendUser = currentAuthUser();
    const isSelfHostedAnonymous = Boolean(backendUser?.isAnonymous);
    const authorizedAndPremium = Boolean(backendUser && !backendUser.isAnonymous && (backendUser as any).spotifyIsPremium);

    function renderLowerSection() {
        if (!playerCompatible) return null;

        if (isSelfHostedAnonymous) {
            return (
                <button
                    onClick={() => dispatch(triggerOAuthLogin('spotify'))}
                    className="w-full py-2.5 bg-[#951518] text-white text-sm font-medium rounded hover:bg-[#731417] transition-colors"
                >
                    Login to create party
                </button>
            );
        }

        if (isAuthorizing || !authStatusKnown) {
            return (
                <button disabled className="w-full py-2.5 bg-white/10 text-white/50 text-sm rounded">
                    Authorizing...
                </button>
            );
        }

        if (!authorizedAndPremium) {
            return (
                <button disabled className="w-full py-2.5 bg-white/10 text-white/50 text-sm rounded">
                    Spotify Premium required
                </button>
            );
        }

        const parties = myParties || [];
        return (
            <div className="w-full">
                {myPartiesLoading && <div className="flex justify-center my-2"><Spinner size={24} /></div>}

                {parties.length > 0 && (
                    <div className="mb-3">
                        {parties.map(p => (
                            <PartyRow
                                key={p.id}
                                p={p}
                                onEnd={() => dispatch(endPartyStart(p.id))}
                            />
                        ))}
                    </div>
                )}

                {showCreateForm ? (
                    <div className="mt-2">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Party name"
                            value={createPartyName}
                            onChange={e => dispatch(changeCreatePartyName(e.target.value))}
                            onKeyPress={e => {
                                if (e.key === 'Enter' && createPartyName.trim()) dispatch(createPartyStart());
                            }}
                            className="w-full bg-transparent border-b border-white/30 text-white text-lg pb-1 outline-none focus:border-[#951518] transition-colors mb-3"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => dispatch(createPartyStart())}
                                disabled={partyCreationInProgress || !createPartyName.trim()}
                                className="flex-1 py-2 bg-[#951518] text-white text-sm rounded disabled:opacity-50 hover:bg-[#731417] transition-colors"
                            >
                                {partyCreationInProgress ? 'Creating...' : 'Create'}
                            </button>
                            <button
                                onClick={() => dispatch(hideCreatePartyForm())}
                                className="px-4 py-2 text-white/60 hover:text-white text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => dispatch(showCreatePartyForm())}
                        className="w-full py-2.5 bg-[#951518] text-white text-sm font-medium rounded hover:bg-[#731417] transition-colors"
                    >
                        {parties.length > 0 ? 'New Party' : 'Create Party'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen px-4 text-center"
            style={{
                background: 'linear-gradient(rgba(28,31,36,0.9),rgba(28,31,36,0.9)), url(/home-bg.jpg) no-repeat center / cover',
            }}
        >
            <header className="mb-4">
                <FestifyLogo size={180} />
            </header>

            <p className="max-w-md text-xl px-6 mb-6 text-white/90">
                Festify lets your guests choose which music should be played using their smartphones.
            </p>

            <main className="w-full max-w-xs flex flex-col gap-3">
                <div>
                    <input
                        type="tel"
                        placeholder="Party Code"
                        value={partyId}
                        onChange={e => dispatch(changePartyId(e.target.value))}
                        onKeyPress={e => {
                            if (e.key === 'Enter' && partyIdValid) dispatch(joinPartyStart());
                        }}
                        className="w-full bg-transparent border-b border-white/30 text-white text-2xl pb-1 text-center outline-none focus:border-[#951518] tracking-widest transition-colors"
                    />
                </div>

                <button
                    onClick={() => dispatch(joinPartyStart())}
                    disabled={!partyIdValid}
                    className="w-full py-2.5 bg-[#951518] text-white text-sm font-medium rounded disabled:opacity-40 hover:bg-[#731417] transition-colors"
                >
                    {partyJoinInProgress ? 'Joining...' : 'Join Party'}
                </button>

                {renderLowerSection()}
            </main>
        </div>
    );
}
