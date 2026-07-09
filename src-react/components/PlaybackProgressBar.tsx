import { useEffect, useRef } from 'react';
import { createSelector } from 'reselect';
import { playbackSelector } from '../../src/selectors/party';
import { currentTrackIdSelector, metadataSelector } from '../../src/selectors/track';
import { Metadata, State } from '../../src/state';
import { useAppSelector } from '../hooks/useAppDispatch';

const currentDurationSelector = createSelector(
    metadataSelector,
    currentTrackIdSelector,
    (metadata: Record<string, Metadata>, trackId: string | null) =>
        trackId && trackId in metadata ? metadata[trackId].durationMs : 0,
);

export function PlaybackProgressBar() {
    const durationMs = useAppSelector(currentDurationSelector);
    const playback = useAppSelector(playbackSelector);
    const indicatorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = indicatorRef.current;
        if (!el) return;

        if (!playback || durationMs <= 0) {
            el.style.transition = 'none';
            el.style.transform = 'scaleX(0)';
            return;
        }

        const { last_change, last_position_ms, playing } = playback;
        let pct = last_position_ms / durationMs;
        if (playing) pct += (Date.now() - last_change) / durationMs;
        pct = Math.max(0, Math.min(1, pct));

        requestAnimationFrame(() => {
            el.style.transition = 'none';
            el.style.transform = `scaleX(${pct})`;
            if (playing) {
                requestAnimationFrame(() => {
                    const remaining = durationMs * (1 - pct);
                    el.style.transition = `transform ${remaining}ms linear`;
                    el.style.transform = 'scaleX(1)';
                });
            }
        });
    }, [durationMs, playback]);

    return (
        <div className="absolute bottom-0 left-0 right-0 h-px">
            <div
                ref={indicatorRef}
                className="h-full bg-white origin-left"
                style={{ transform: 'scaleX(0)' }}
            />
        </div>
    );
}
