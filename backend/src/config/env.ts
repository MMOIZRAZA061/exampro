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

const required: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? "",
    PORT: process.env.PORT || "4000",
};

for (const [key, val] of Object.entries(required)) {
    if (!val) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

export const env = {
    DATABASE_URL: required.DATABASE_URL,
    JWT_SECRET: required.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    PORT: parseInt(required.PORT, 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
};
