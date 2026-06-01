export interface Config {
    databaseUrl: string;
    port: number;
    publicOrigin: string;
    spotifyClientId: string;
    spotifyClientSecret: string;
    tokenEncryptionSecret: string;
    allowedHostEmails: string[];
}

function readEnv(name: string, fallback = ''): string {
    return process.env[name] || fallback;
}

export const config: Config = {
    databaseUrl: readEnv('DATABASE_URL', 'postgres://festify:festify@localhost:5432/festify'),
    port: Number(readEnv('PORT', '8089')),
    publicOrigin: readEnv('PUBLIC_ORIGIN', 'http://localhost:8088'),
    spotifyClientId: readEnv('SPOTIFY_CLIENT_ID'),
    spotifyClientSecret: readEnv('SPOTIFY_CLIENT_SECRET'),
    tokenEncryptionSecret: readEnv('TOKEN_ENCRYPTION_SECRET'),
    allowedHostEmails: readEnv('FESTIFY_ALLOWED_HOST_EMAILS')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(email => !!email),
};

export function requireConfig(value: string, name: string): string {
    if (!value) {
        throw new Error(`Missing required environment variable ${name}`);
    }

    return value;
}

