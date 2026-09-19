import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: any
    ) {
        super(message);
    }
}

export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: "Validation failed",
            details: err.errors,
        });
    }

    // ApiError
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            error: err.message,
            details: err.details,
        });
    }

    // Postgres unique constraint
    if (err.code === "23505") {
        return res.status(409).json({ error: "Resource already exists" });
    }

    // Postgres foreign key violation
    if (err.code === "23503") {
        return res.status(400).json({ error: "Invalid reference to related resource" });
    }

    // Postgres not null violation
    if (err.code === "23502") {
        return res.status(400).json({ error: "Missing required field" });
    }

    // Postgres check constraint
    if (err.code === "23514") {
        return res.status(400).json({ error: "Invalid value for field" });
    }

    // DB connection error
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        return res.status(503).json({
            error: "Database connection failed",
        });
    }

    console.error("Uncaught error:", err);
    return res.status(500).json({
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}
