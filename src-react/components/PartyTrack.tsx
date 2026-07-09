import { useEffect, useRef, useMemo } from 'react';
import { createSelector } from 'reselect';

import { installPlaybackMaster } from '../../src/actions/party-data';
import { togglePlaybackStart } from '../../src/actions/playback-spotify';
import { removeTrackAction, requestSetVoteAction } from '../../src/actions/queue';
import {
    hasOtherPlaybackMasterSelector,
    isPartyOwnerSelector,
    isPlaybackMasterSelector,
    playbackMasterSelector,
    playbackSelector,
} from '../../src/selectors/party';
import {
    artistJoinerFactory,
    currentTrackSelector,
    singleMetadataSelector,
    singleTrackSelector,
    tracksEqual,
    voteStringGeneratorFactory,
} from '../../src/selectors/track';
import { hasConnectedSpotifyAccountSelector } from '../../src/selectors/users';
import { State, TrackReference } from '../../src/state';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { TrackCover } from './TrackCover';
import {
    FavoriteIcon,
    FavoriteBorderIcon,
    AddIcon,
    SkipNextIcon,
    PauseIcon,
    PlayArrowIcon,
    DownloadIcon,
    ClearIcon,
} from './Icons';
import { Spinner } from './Spinner';

function formatTrackTime(ms: number): string {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function makeTrackSelectors(trackId: string) {
    const trackSel = (s: State) => singleTrackSelector(s, trackId);
    const isCompatibleSel = (s: State) => s.player.isCompatible;
    const isPlayingSel = createSelector(
        currentTrackSelector,
        trackSel,
        (current, track) => tracksEqual(current, track),
    );
    const hasVotesOrFallback = createSelector(trackSel, t => Boolean(t && (t.vote_count > 0 || t.is_fallback)));
    const showRemoveSel = createSelector(
        isPartyOwnerSelector,
        hasVotesOrFallback,
        isPlayingSel,
        (isOwner, has, isPlaying) => isOwner && has && !isPlaying,
    );
    const showTakeoverSel = createSelector(
        isPartyOwnerSelector,
        isPlaybackMasterSelector,
        playbackMasterSelector,
        isPlayingSel,
        isCompatibleSel,
        hasConnectedSpotifyAccountSelector,
        (isOwner, isMaster, master, isPlaying, isCompat, hasSpt) =>
            Boolean(isPlaying && isOwner && !isMaster && master && isCompat && hasSpt),
    );
    const enablePlaySel = createSelector(
        isPartyOwnerSelector,
        (s: State) => s.player.togglingPlayback,
        isCompatibleSel,
        hasConnectedSpotifyAccountSelector,
        hasOtherPlaybackMasterSelector,
        (isOwner, isToggling, isCompat, hasSpt, hasOther) =>
            isOwner && !isToggling && ((!isCompat && hasOther) || isCompat) && ((!hasSpt && hasOther) || hasSpt),
    );
    const artistJoiner = artistJoinerFactory();
    const voteStringGen = voteStringGeneratorFactory(trackSel);

    return { trackSel, isPlayingSel, showRemoveSel, showTakeoverSel, enablePlaySel, artistJoiner, voteStringGen };
}

export function PartyTrack({ trackId, isFirstInQueue = false }: { trackId: string; isFirstInQueue?: boolean }) {
    const dispatch = useAppDispatch();

    const selectors = useMemo(() => makeTrackSelectors(trackId), [trackId]);

    const track = useAppSelector(s => selectors.trackSel(s));
    const metadata = useAppSelector(s => singleMetadataSelector(s, trackId));
    const playback = useAppSelector(playbackSelector);
    const isPlayingTrack = useAppSelector(s => selectors.isPlayingSel(s));
    const showRemove = useAppSelector(s => selectors.showRemoveSel(s));
    const showTakeover = useAppSelector(s => selectors.showTakeoverSel(s));
    const enablePlay = useAppSelector(s => selectors.enablePlaySel(s));
    const artistName = useAppSelector(s => selectors.artistJoiner(s, trackId));
    const voteString = useAppSelector(s => selectors.voteStringGen(s, trackId));
    const hasVoted = useAppSelector(s => Boolean(s.party.userVotes && s.party.userVotes[trackId]));
    const isOwner = useAppSelector(isPartyOwnerSelector);
    const isMusicPlaying = useAppSelector(s => Boolean(s.party.currentParty?.playback?.playing));
    const togglingPlayback = useAppSelector(s => s.player.togglingPlayback);

    const fillRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // Progress calculations
    let progressPercent: number | null = null;
    let progressRemainingMs: number | null = null;
    let progressText: string | null = null;

    if (isPlayingTrack && metadata && playback) {
        const dur = metadata.durationMs || 0;
        const cur = Math.max(0, Math.min(dur, playback.last_position_ms + (playback.playing ? Date.now() - playback.last_change : 0)));
        if (dur > 0) {
            progressPercent = Math.max(0, Math.min(100, (cur / dur) * 100));
            progressRemainingMs = Math.max(0, dur - cur);
            progressText = `${formatTrackTime(cur)} / ${formatTrackTime(dur)}`;
        }
    }

    // CSS transition for progress fill
    useEffect(() => {
        const fill = fillRef.current;
        if (!fill || progressPercent == null || progressRemainingMs == null) return;
        const fraction = progressPercent / 100;
        requestAnimationFrame(() => {
            fill.style.transition = 'none';
            fill.style.transform = `scaleX(${fraction})`;
            requestAnimationFrame(() => {
                fill.style.transition = isMusicPlaying ? `transform ${progressRemainingMs}ms linear` : 'none';
                if (isMusicPlaying) fill.style.transform = 'scaleX(1)';
            });
        });
    }, [progressPercent, progressRemainingMs, isMusicPlaying]);

    // Tick the time text every second independently of the fill animation
    useEffect(() => {
        if (!isPlayingTrack || !metadata || !playback) return;
        const interval = setInterval(() => {
            const el = textRef.current;
            if (!el) return;
            const dur = metadata.durationMs || 0;
            if (dur <= 0) return;
            const cur = Math.max(0, Math.min(dur, playback.last_position_ms + (playback.playing ? Date.now() - playback.last_change : 0)));
            el.textContent = `${formatTrackTime(cur)} / ${formatTrackTime(dur)}`;
        }, 1000);
        return () => clearInterval(interval);
    }, [isPlayingTrack, metadata, playback]);

    const ref = track?.reference as TrackReference | undefined;

    function likeIcon() {
        if (!track) return null;
        if (hasVoted) return <FavoriteIcon size={24} className="text-white" />;
        if (track.vote_count > 0 || track.is_fallback) return <FavoriteBorderIcon size={24} className="text-white" />;
        return <AddIcon size={24} className="text-white" />;
    }

    return (
        <div className={`flex items-center px-4 ${isFirstInQueue ? 'py-[13px] bg-[#22262b]' : 'py-[5px]'}`}>
            <div className="mr-4 shrink-0">
                <TrackCover images={metadata?.cover ?? []} size={54} />
            </div>

            <div className="flex-1 min-w-0 mt-0.5 overflow-hidden mr-5">
                <h2 className="m-0 font-light text-[15px] leading-5 truncate">
                    {metadata ? metadata.name : 'Loading...'}
                </h2>
                {artistName && (
                    <aside className="mt-0.5 font-light text-[13px] leading-5 truncate text-white/80">
                        <span>{artistName}</span>
                        <span className="mx-1">·</span>
                        <span>{voteString}</span>
                    </aside>
                )}
                {isPlayingTrack && progressPercent != null && progressText && (
                    <div className="flex items-center gap-2.5 mt-1.5">
                        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                                ref={fillRef}
                                className="h-full bg-[#951518] origin-left"
                                style={{ transform: 'scaleX(0)' }}
                            />
                        </div>
                        <div ref={textRef} className="text-xs text-white/70 whitespace-nowrap shrink-0">
                            {progressText}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center ml-auto shrink-0 gap-1">
                {showTakeover && (
                    <button
                        onClick={() => dispatch(installPlaybackMaster())}
                        title="Transfer playback to current device"
                        className="p-1.5 text-white hover:text-white/70 transition-colors"
                    >
                        <DownloadIcon size={24} />
                    </button>
                )}
                {showRemove && ref && (
                    <button
                        onClick={() => dispatch(removeTrackAction(ref, false))}
                        title={`Remove ${metadata?.name ?? ''} from queue`}
                        className="p-1.5 text-white hover:text-white/70 transition-colors"
                    >
                        <ClearIcon size={24} />
                    </button>
                )}
                {isPlayingTrack ? (
                    <>
                        {isOwner && ref && (
                            <button
                                onClick={() => dispatch(removeTrackAction(ref, false))}
                                title={`Skip ${metadata?.name ?? ''}`}
                                className="p-1.5 text-white hover:text-white/70 transition-colors"
                            >
                                <SkipNextIcon size={24} />
                            </button>
                        )}
                        <div className="relative ml-1.5">
                            {togglingPlayback && (
                                <div className="absolute -inset-0.5 flex items-center justify-center pointer-events-none">
                                    <Spinner size={44} />
                                </div>
                            )}
                            <button
                                onClick={() => dispatch(togglePlaybackStart())}
                                disabled={!enablePlay}
                                className="w-10 h-10 rounded-full bg-[#951518] flex items-center justify-center text-white disabled:opacity-70 hover:bg-[#731417] transition-colors"
                            >
                                {isMusicPlaying ? <PauseIcon size={20} /> : <PlayArrowIcon size={20} />}
                            </button>
                        </div>
                    </>
                ) : (
                    ref && (
                        <button
                            onClick={() => dispatch(requestSetVoteAction(ref, !hasVoted))}
                            title={`${hasVoted ? 'Unvote' : 'Vote for'} ${metadata?.name ?? ''}`}
                            className="p-1.5 text-white hover:text-white/70 transition-colors"
                        >
                            {likeIcon()}
                        </button>
                    )
                )}
            </div>
        </div>
    );
}
