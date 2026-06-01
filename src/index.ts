// tslint:disable:ordered-imports

// tslint:disable:no-reference
/// <reference path="../node_modules/@types/spotify-web-playback-sdk/index.d.ts"/>
/// <reference path="../node_modules/spotify-web-api-js/src/typings/spotify-api.d.ts"/>

import { backendConfig } from './util/backend';
import './util/raven';
import './store';
import './views/app-shell';

const currentScript = document.currentScript as HTMLScriptElement | null;
const bundleVersion = currentScript
    ? new URL(currentScript.src, window.location.href).searchParams.get('v')
    : null;

console.info('Festify bootstrap', {
    backendType: backendConfig.type,
    apiUrl: backendConfig.apiUrl,
    bundleVersion,
    realtimeUrl: backendConfig.realtimeUrl,
});
