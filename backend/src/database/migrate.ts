import { pool } from "./index.js";
import fs from "fs";
import path from "path";

async function migrate() {
    console.log("Starting database migrations...");

    // Create migrations tracking table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

    const migrationsDir = path.resolve(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

    const alreadyApplied = new Set<string>(
        (await pool.query("SELECT filename FROM _migrations")).rows.map(
            (r: any) => r.filename
        )
    );

    for (const file of files) {
        if (alreadyApplied.has(file)) {
            console.log(`Skipping ${file} (already applied)`);
            continue;
        }

        console.log(`Applying ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query(
                "INSERT INTO _migrations (filename) VALUES ($1)",
                [file]
            );
            await client.query("COMMIT");
            console.log(`Applied ${file} successfully`);
        } catch (err) {
            await client.query("ROLLBACK");
            console.error(`Failed to apply ${file}:`, err);
            process.exit(1);
        } finally {
            client.release();
        }
    }

    console.log("All migrations completed successfully");
    await pool.end();
}

migrate();
