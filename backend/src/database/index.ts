import { env, requireEnv } from "../config/env.js";
import pg from "pg";

const { Pool } = pg;

/**
 * Lazy database pool for serverless environments (Vercel).
 *
 * On Vercel each serverless invocation is cold-started. We do NOT want the
 * module to crash at import time when DATABASE_URL is missing (e.g. env vars
 * not yet set, or a preview deployment with no DB). Instead, the pool is
 * created on the first real query, so a missing var surfaces as a clear,
 * actionable 503 from the error handler — not an unhandled module-load crash
 * that returns no body (which the frontend mis-reads as a credential error).
 */
let poolInstance: pg.Pool | null = null;

function createPool(): pg.Pool {
    const p = new Pool({
        connectionString: requireEnv("DATABASE_URL"),
        ssl:
            env.NODE_ENV === "production"
                ? { rejectUnauthorized: false }
                : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
    p.on("error", (err) => {
        console.error("Unexpected database pool error:", err.message);
    });
    return p;
}

function getPool(): pg.Pool {
    if (!poolInstance) {
        poolInstance = createPool();
    }
    return poolInstance;
}

/**
 * A proxy that transparently delegates every Pool method to the lazily-created
 * pool. This keeps the existing `pool` export working across the codebase
 * without forcing pool creation at module load time.
 */
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
    get(_target, prop: string) {
        const p = getPool();
        const v = (p as any)[prop];
        return typeof v === "function" ? v.bind(p) : v;
    },
});

/**
 * Execute a query and return the result.
 */
export async function query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<pg.QueryResult<T>> {
    const p = getPool();
    const start = Date.now();
    try {
        const res = await p.query<T>(text, params);
        const duration = Date.now() - start;
        if (env.NODE_ENV === "development" && duration > 500) {
            console.warn(
                `Slow query: ${duration}ms - ${text.substring(0, 80)}...`
            );
        }
        return res;
    } catch (err) {
        console.error("Database query error:", err);
        throw err;
    }
}

/**
 * Execute multiple queries within a transaction.
 */
export async function withTransaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const p = getPool();
    const client = await p.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function getClient(): Promise<pg.PoolClient> {
    const p = getPool();
    return p.connect();
}
