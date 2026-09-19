import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import teacherRoutes from "./routes/teacher.js";
import examRoutes from "./routes/exam.js";
import studentRoutes from "./routes/student.js";

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
    cors({
        origin: env.CORS_ORIGIN.split(","),
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Request logging
if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}

// Rate limiting
// Only enforce in production. The loop was hammering the limiter in dev and
// leaving it locked out; disabling it in dev avoids that during local testing.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "development" ? 5000 : 100,
    message: { error: "Too many requests, please try again later" },
    skip: env.NODE_ENV === "development" ? () => true : undefined,
});
app.use("/api/", limiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/students", studentRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
