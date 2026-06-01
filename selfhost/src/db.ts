import pg from 'pg';

import { config } from './config.js';

export const pool = new pg.Pool({
    connectionString: config.databaseUrl,
});

// Dedicated non-pooled client for LISTEN/NOTIFY.
// Pool connections are returned after each query and cannot maintain persistent LISTEN state.
export const listenClient = new pg.Client({
    connectionString: config.databaseUrl,
});

export async function checkDatabase(): Promise<void> {
    await pool.query('SELECT 1');
}
