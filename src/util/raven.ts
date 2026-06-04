/// <reference path="../types/sentry-browser.d.ts" />
import * as Sentry from '@sentry/browser';

import { SENTRY_URL } from '../../common.config';

if (SENTRY_URL && /^https?:\/\//.test(SENTRY_URL)) {
    Sentry.init({ dsn: SENTRY_URL });
}

export default {
    captureException: (err: Error | string) => Sentry.captureException(err),
};
