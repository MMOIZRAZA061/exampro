import { env } from "../config/env.js";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
    console.error("Unexpected database pool error:", err.message);
});

/**
 * Execute a query and return the result.
 */
export async function query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    try {
        const res = await pool.query<T>(text, params);
        const duration = Date.now() - start;
        if (env.NODE_ENV === "development" && duration > 500) {
            console.warn(`Slow query: ${duration}ms - ${text.substring(0, 80)}...`);
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
    const client = await pool.connect();
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
    return pool.connect();
}
