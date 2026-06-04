import { backendConfig, isSelfHostedBackend } from './backend';

// Tags whose console.log output is forwarded to the backend debug endpoint.
// Read on the server with: docker logs -f festify-api 2>&1 | grep BROWSER
const WATCHED_TAGS = ['[poll]', '[player]', '[queue]', '[sdk]', '[sdk-raw]', '[hpsc]', '[playTrack]'];

const ENDPOINT = `${backendConfig.apiUrl}/api/debug/log`;
const BATCH_INTERVAL_MS = 2000;

let queue: { level: string; msg: string; ts: number }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
    timer = null;
    if (!queue.length) return;
    const entries = queue;
    queue = [];
    fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
    }).catch(() => {/* ignore network errors */});
}

function enqueue(level: string, args: any[]) {
    const msg = args.map(a => {
        if (a === null || a === undefined) return String(a);
        if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch { return '[object]'; }
        }
        return String(a);
    }).join(' ');

    queue.push({ level, msg, ts: Date.now() });
    if (!timer) {
        timer = setTimeout(flush, BATCH_INTERVAL_MS);
    }
}

function isWatched(args: any[]): boolean {
    const first = typeof args[0] === 'string' ? args[0] : '';
    return WATCHED_TAGS.some(tag => first.startsWith(tag));
}

export function installRemoteLogger() {
    if (!isSelfHostedBackend) return;

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    console.log = (...args: any[]) => {
        origLog(...args);
        if (isWatched(args)) enqueue('log', args);
    };
    console.warn = (...args: any[]) => {
        origWarn(...args);
        if (isWatched(args)) enqueue('warn', args);
    };
    console.error = (...args: any[]) => {
        origError(...args);
        if (isWatched(args)) enqueue('error', args);
    };
}
