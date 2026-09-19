import { config } from "dotenv";
import path from "path";

// Load a local .env if one exists (dev). On Vercel this file is absent, but
// the DATABASE_URL / JWT_SECRET values are injected directly as process env
// vars, so the optional load below is safe.
try {
    config({ path: path.resolve(__dirname, "../../.env") });
} catch {
    // no local .env — rely on injected environment variables (Vercel)
}

// On Vercel the values come in as injected env vars; locally we load .env.
// We deliberately do NOT throw here on a missing var: a hard crash at module
// load makes the whole serverless function return no body, which the
// frontend mis-reads as a credential error. Missing vars instead surface as
// clear, actionable errors at the point of use (DB pool, JWT signing).
const values: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? "",
    PORT: process.env.PORT || "4000",
};

export function requireEnv(key: "DATABASE_URL" | "JWT_SECRET"): string {
    const v = values[key];
    if (!v) {
        throw new Error(
            `Missing required environment variable: ${key}. ` +
            (key === "DATABASE_URL"
                ? "Set it in your Vercel project Settings -> Environment Variables."
                : "Set it in your Vercel project Settings -> Environment Variables.")
        );
    }
    return v;
}

export const env = {
    DATABASE_URL: values.DATABASE_URL,
    JWT_SECRET: values.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    PORT: parseInt(values.PORT, 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
};
