import { Actions, ASSIGN_INSTANCE_ID } from '../actions';
import {
    PLAYER_ERROR,
    PLAYER_INIT_FINISH,
    SET_PLAYER_COMPATIBILITY,
    SPOTIFY_SDK_INIT_FINISH,
    TOGGLE_PLAYBACK_FAIL,
    TOGGLE_PLAYBACK_FINISH,
    TOGGLE_PLAYBACK_START,
    LOAD_PLAYBACK_DEVICES_FAIL,
    LOAD_PLAYBACK_DEVICES_FINISH,
    LOAD_PLAYBACK_DEVICES_START,
    SELECT_PLAYBACK_DEVICE,
    TRANSFER_PLAYBACK_DEVICE_FAIL,
    TRANSFER_PLAYBACK_DEVICE_FINISH,
    TRANSFER_PLAYBACK_DEVICE_START,
} from '../actions/playback-spotify';
import { PlayerState } from '../state';

export default function(
    state: PlayerState = {
        availableDevices: [],
        deviceLoadError: null,
        deviceLoadInProgress: false,
        instanceId: '',
        localDeviceId: null,
        initializing: false,
        initializationError: null,
        isCompatible: true,
        sdkReady: false,
        selectedDeviceId: null,
        transferPlaybackError: null,
        transferPlaybackInProgress: false,
        togglingPlayback: false,
        togglePlaybackError: null,
    },
    action: Actions,
): PlayerState {
    switch (action.type) {
        case ASSIGN_INSTANCE_ID:
            return {
                ...state,
                instanceId: action.payload,
            };
        case PLAYER_INIT_FINISH:
            return {
                ...state,
                initializing: false,
                initializationError: null,
                localDeviceId: action.payload,
                selectedDeviceId: state.selectedDeviceId || action.payload,
            };
        case PLAYER_ERROR:
            return {
                ...state,
                initializing: false,
                initializationError: action.payload,
            };
        case TOGGLE_PLAYBACK_START:
            return {
                ...state,
                togglingPlayback: true,
                togglePlaybackError: null,
            };
        case TOGGLE_PLAYBACK_FINISH:
            return {
                ...state,
                togglingPlayback: false,
                togglePlaybackError: null,
            };
        case TOGGLE_PLAYBACK_FAIL:
            return {
                ...state,
                togglingPlayback: false,
                togglePlaybackError: action.payload,
            };
        case SPOTIFY_SDK_INIT_FINISH:
            return {
                ...state,
                sdkReady: true,
            };
        case LOAD_PLAYBACK_DEVICES_START:
            return {
                ...state,
                deviceLoadInProgress: true,
                deviceLoadError: null,
            };
        case LOAD_PLAYBACK_DEVICES_FINISH: {
            const activeDevice = action.payload.find(device => device.is_active);
            const selected =
                state.selectedDeviceId &&
                action.payload.some(device => device.id === state.selectedDeviceId)
                    ? state.selectedDeviceId
                    : (activeDevice ? activeDevice.id : null) ||
                      state.localDeviceId ||
                      (action.payload[0] ? action.payload[0].id : null);
            return {
                ...state,
                availableDevices: action.payload,
                deviceLoadInProgress: false,
                deviceLoadError: null,
                selectedDeviceId: selected,
            };
        }
        case LOAD_PLAYBACK_DEVICES_FAIL:
            return {
                ...state,
                deviceLoadInProgress: false,
                deviceLoadError: action.payload,
            };
        case SELECT_PLAYBACK_DEVICE:
            return {
                ...state,
                selectedDeviceId: action.payload,
            };
        case TRANSFER_PLAYBACK_DEVICE_START:
            return {
                ...state,
                transferPlaybackInProgress: true,
                transferPlaybackError: null,
            };
        case TRANSFER_PLAYBACK_DEVICE_FINISH:
            return {
                ...state,
                transferPlaybackInProgress: false,
                transferPlaybackError: null,
            };
        case TRANSFER_PLAYBACK_DEVICE_FAIL:
            return {
                ...state,
                transferPlaybackInProgress: false,
                transferPlaybackError: action.payload,
            };
        case SET_PLAYER_COMPATIBILITY:
            return {
                ...state,
                isCompatible: action.payload,
            };
        default:
            return state;
    }
}
