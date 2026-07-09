import { useEffect } from 'react';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { hideToast } from '../../src/actions';

export function Toast({ text }: { text: string }) {
    const dispatch = useAppDispatch();

    useEffect(() => {
        const timer = setTimeout(() => dispatch(hideToast()), 3000);
        return () => clearTimeout(timer);
    }, [text, dispatch]);

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-[#951518] text-white px-4 py-3 rounded shadow-lg z-50 text-sm font-medium">
            {text}
        </div>
    );
}
