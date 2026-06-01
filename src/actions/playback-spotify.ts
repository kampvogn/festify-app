export type Actions =
    | ReturnType<typeof playerInitFinish>
    | ReturnType<typeof playerError>
    | ReturnType<typeof spotifySdkInitFinish>
    | ReturnType<typeof play>
    | ReturnType<typeof pause>
    | ReturnType<typeof togglePlaybackFail>
    | ReturnType<typeof togglePlaybackFinish>
    | ReturnType<typeof togglePlaybackStart>
    | ReturnType<typeof setPlayerCompatibility>
    | ReturnType<typeof loadPlaybackDevicesStart>
    | ReturnType<typeof loadPlaybackDevicesFinish>
    | ReturnType<typeof loadPlaybackDevicesFail>
    | ReturnType<typeof selectPlaybackDevice>
    | ReturnType<typeof transferPlaybackDeviceStart>
    | ReturnType<typeof transferPlaybackDeviceFinish>
    | ReturnType<typeof transferPlaybackDeviceFail>
    | ReturnType<typeof setVolume>;

export const PLAYER_INIT_FINISH = 'PLAYER_INIT_Finish';
export const PLAYER_ERROR = 'PLAYER_ERROR';
export const PLAY = 'PLAY';
export const PAUSE = 'PAUSE';
export const SPOTIFY_SDK_INIT_FINISH = 'SPOTIFY_SDK_INIT_Finish';
export const TOGGLE_PLAYBACK_FAIL = 'TOGGLE_PLAYBACK_Fail';
export const TOGGLE_PLAYBACK_FINISH = 'TOGGLE_PLAYBACK_Finish';
export const TOGGLE_PLAYBACK_START = 'TOGGLE_PLAYBACK_Start';
export const SET_PLAYER_COMPATIBILITY = 'SET_PLAYER_COMPATIBILITY';
export const LOAD_PLAYBACK_DEVICES_FAIL = 'LOAD_PLAYBACK_DEVICES_Fail';
export const LOAD_PLAYBACK_DEVICES_FINISH = 'LOAD_PLAYBACK_DEVICES_Finish';
export const LOAD_PLAYBACK_DEVICES_START = 'LOAD_PLAYBACK_DEVICES_Start';
export const SELECT_PLAYBACK_DEVICE = 'SELECT_PLAYBACK_DEVICE';
export const TRANSFER_PLAYBACK_DEVICE_FAIL = 'TRANSFER_PLAYBACK_DEVICE_Fail';
export const TRANSFER_PLAYBACK_DEVICE_FINISH = 'TRANSFER_PLAYBACK_DEVICE_Finish';
export const TRANSFER_PLAYBACK_DEVICE_START = 'TRANSFER_PLAYBACK_DEVICE_Start';

export const playerInitFinish = (deviceId: string) => ({
    type: PLAYER_INIT_FINISH as typeof PLAYER_INIT_FINISH,
    payload: deviceId,
});

export const playerError = (error: Error) => ({
    type: PLAYER_ERROR as typeof PLAYER_ERROR,
    error: true,
    payload: error,
});

export const play = (trackId: string, position: number) => ({
    type: PLAY as typeof PLAY,
    payload: { trackId, position },
});

export const pause = () => ({ type: PAUSE as typeof PAUSE });

export const spotifySdkInitFinish = () => ({
    type: SPOTIFY_SDK_INIT_FINISH as typeof SPOTIFY_SDK_INIT_FINISH,
});

export const togglePlaybackStart = () => ({
    type: TOGGLE_PLAYBACK_START as typeof TOGGLE_PLAYBACK_START,
});

export const togglePlaybackFinish = () => ({
    type: TOGGLE_PLAYBACK_FINISH as typeof TOGGLE_PLAYBACK_FINISH,
});

export const togglePlaybackFail = (err: Error) => ({
    type: TOGGLE_PLAYBACK_FAIL as typeof TOGGLE_PLAYBACK_FAIL,
    error: true,
    payload: err,
});

export const setPlayerCompatibility = (compatible: boolean) => ({
    type: SET_PLAYER_COMPATIBILITY as typeof SET_PLAYER_COMPATIBILITY,
    payload: compatible,
});

export const loadPlaybackDevicesStart = () => ({
    type: LOAD_PLAYBACK_DEVICES_START as typeof LOAD_PLAYBACK_DEVICES_START,
});

export const loadPlaybackDevicesFinish = (devices: SpotifyApi.UserDevice[]) => ({
    type: LOAD_PLAYBACK_DEVICES_FINISH as typeof LOAD_PLAYBACK_DEVICES_FINISH,
    payload: devices,
});

export const loadPlaybackDevicesFail = (err: Error) => ({
    type: LOAD_PLAYBACK_DEVICES_FAIL as typeof LOAD_PLAYBACK_DEVICES_FAIL,
    error: true,
    payload: err,
});

export const selectPlaybackDevice = (deviceId: string | null) => ({
    type: SELECT_PLAYBACK_DEVICE as typeof SELECT_PLAYBACK_DEVICE,
    payload: deviceId,
});

export const transferPlaybackDeviceStart = () => ({
    type: TRANSFER_PLAYBACK_DEVICE_START as typeof TRANSFER_PLAYBACK_DEVICE_START,
});

export const transferPlaybackDeviceFinish = () => ({
    type: TRANSFER_PLAYBACK_DEVICE_FINISH as typeof TRANSFER_PLAYBACK_DEVICE_FINISH,
});

export const transferPlaybackDeviceFail = (err: Error) => ({
    type: TRANSFER_PLAYBACK_DEVICE_FAIL as typeof TRANSFER_PLAYBACK_DEVICE_FAIL,
    error: true,
    payload: err,
});

export const SET_VOLUME = 'SET_VOLUME';
export const setVolume = (volume: number) => ({
    type: SET_VOLUME as typeof SET_VOLUME,
    payload: volume,
});
