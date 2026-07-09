import { useEffect, useRef } from 'react';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export function SpotifySdkLoader({ load }: { load: boolean }) {
    const loaded = useRef(false);

    useEffect(() => {
        if (!load || loaded.current || document.querySelector(`script[src="${SDK_URL}"]`)) return;
        loaded.current = true;
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;
        document.head.appendChild(script);
    }, [load]);

    return null;
}
