import {
    BACKEND_TYPE,
    SELF_HOSTED_API_URL,
    SELF_HOSTED_REALTIME_URL,
} from '../../backend.config.js';

export type BackendType = 'firebase' | 'self-hosted';

export interface BackendConfig {
    type: BackendType;
    apiUrl: string;
    realtimeUrl: string;
}

function normalizeBackendType(value: string): BackendType {
    if (value === 'self-hosted') {
        return 'self-hosted';
    }

    return 'firebase';
}

export const backendConfig: BackendConfig = {
    type: normalizeBackendType(BACKEND_TYPE),
    apiUrl: SELF_HOSTED_API_URL,
    realtimeUrl: SELF_HOSTED_REALTIME_URL,
};

export const isFirebaseBackend = backendConfig.type === 'firebase';
export const isSelfHostedBackend = backendConfig.type === 'self-hosted';

