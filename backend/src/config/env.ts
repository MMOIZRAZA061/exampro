import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../.env") });

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
