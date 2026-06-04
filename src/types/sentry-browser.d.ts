// Stub until @sentry/browser is installed. Remove once `yarn add @sentry/browser@^7` has run.
declare module '@sentry/browser' {
    export function init(options: { dsn: string; [key: string]: any }): void;
    export function captureException(err: Error | string | unknown): string;
}
