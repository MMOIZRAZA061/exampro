// Vercel serverless entry point.
//
// src/index.ts calls `app.listen()` on import, which crashes in Vercel's
// serverless sandbox. So instead of importing that module, we rebuild the same
// Express pipeline here WITHOUT the listen() call.
//
// Vercel auto-detects a top-level .ts / .js file that exports a default
// async (req, res) => {} as a serverless function. No @vercel/node needed.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "../src/config/env.js";
import { notFoundHandler, errorHandler } from "../src/middleware/errorHandler.js";
import authRoutes from "../src/routes/auth.js";
import adminRoutes from "../src/routes/admin.js";
import teacherRoutes from "../src/routes/teacher.js";
import examRoutes from "../src/routes/exam.js";
import studentRoutes from "../src/routes/student.js";

// Build the Express app exactly like src/index.ts does, minus the listen() call.
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
    cors({
        origin: env.CORS_ORIGIN.split(","),
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // In serverless there is no warm "dev loop" — always enforce the limiter.
    max: 100,
    message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/students", studentRoutes);

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Vercel handler: forward Vercel's WHATWG Request/Response into Express.
export default async (req: any, res: any) => {
    app(req, res);
};
