import {
    SELF_HOSTED_API_URL,
    SELF_HOSTED_REALTIME_URL,
} from '../../backend.config.js';

export interface BackendConfig {
    apiUrl: string;
    realtimeUrl: string;
}

export const backendConfig: BackendConfig = {
    apiUrl: SELF_HOSTED_API_URL,
    realtimeUrl: SELF_HOSTED_REALTIME_URL,
};
