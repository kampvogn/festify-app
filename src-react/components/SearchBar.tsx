import { useRef, useEffect } from 'react';
import { changeTrackSearchInput, eraseTrackSearchInput } from '../../src/actions/view-party';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { ArrowBackIcon } from './Icons';
import { FestifyLogo } from './FestifyLogo';

export function SearchBar() {
    const dispatch = useAppDispatch();
    const text = useAppSelector(s => (s.router as any).query?.s || '');
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep input value in sync when cleared externally
    useEffect(() => {
        if (inputRef.current && inputRef.current.value !== text) {
            inputRef.current.value = text;
        }
    }, [text]);

    return (
        <div className="flex items-center h-12 bg-[#fafafa] rounded shadow-md text-black mx-2 mb-4">
            {text ? (
                <button
                    className="shrink-0 p-2 mx-1 text-black hover:text-black/60 transition-colors"
                    onClick={() => dispatch(eraseTrackSearchInput())}
                    aria-label="Clear search"
                >
                    <ArrowBackIcon size={24} />
                </button>
            ) : (
                <div className="shrink-0 mx-3">
                    <FestifyLogo size={24} />
                </div>
            )}
            <input
                ref={inputRef}
                type="search"
                defaultValue={text}
                placeholder="Add Tracks"
                className="flex-1 h-full bg-transparent border-0 text-black text-base leading-6 mr-4 focus:outline-none placeholder:text-black/54"
                onChange={e => dispatch(changeTrackSearchInput(e.target.value))}
            />
        </div>
    );
}
