import { Routes, Route } from 'react-router-dom';

import { NavigationSync } from './NavigationSync';
import { Toast } from './components/Toast';
import { SpotifySdkLoader } from './components/SpotifySdkLoader';
import { Home } from './pages/Home';
import { Party } from './pages/Party';
import { Tv } from './pages/Tv';
import { OAuthCallback } from './pages/OAuthCallback';
import { useAppSelector } from './hooks/useAppDispatch';
import { isPlaybackMasterSelector } from '../src/selectors/party';

export function App() {
    const isPlaybackMaster = useAppSelector(isPlaybackMasterSelector);
    const toastText = useAppSelector(s => s.appShell.currentToast);

    return (
        <>
            <NavigationSync />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/callback" element={<OAuthCallback />} />
                <Route path="/party/:partyId/*" element={<Party />} />
                <Route path="/tv/:partyId" element={<Tv />} />
            </Routes>
            {toastText && <Toast text={toastText} />}
            <SpotifySdkLoader load={isPlaybackMaster} />
        </>
    );
}
