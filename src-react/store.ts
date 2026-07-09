import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

import { generateInstanceId } from '../src/actions';
import { spotifySdkInitFinish } from '../src/actions/playback-spotify';
import reducers from '../src/reducers';
import sagas from '../src/sagas';
import { routerReducer, LOCATION_CHANGED } from './routing-bridge';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
    // Cast to any: existing reducers use the old Actions union type (TS3 era)
    // which is narrower than RTK's UnknownAction. This is safe at runtime.
    reducer: {
        ...reducers,
        router: routerReducer,
    } as any,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            thunk: false,
            serializableCheck: false,
        }).concat(sagaMiddleware as any),
    devTools: process.env.NODE_ENV !== 'production',
});

for (const s of sagas) {
    sagaMiddleware.run(s);
}

store.dispatch(generateInstanceId());

window.onSpotifyWebPlaybackSDKReady = () => {
    store.dispatch(spotifySdkInitFinish());
};

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { LOCATION_CHANGED };
