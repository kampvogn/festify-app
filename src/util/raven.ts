import * as raven from 'raven-js';

import { SENTRY_URL } from '../../common.config';

const Raven = new (raven as any).Client();

if (SENTRY_URL && /^https?:\/\//.test(SENTRY_URL)) {
    Raven.config(SENTRY_URL).install();
}

export default Raven;
