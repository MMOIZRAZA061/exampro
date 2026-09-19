import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env, requireEnv } from "../config/env.js";

export interface AuthUser {
    id: string;
    email: string;
    role: "admin" | "teacher" | "student";
    fullName: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export function generateToken(payload: AuthUser): string {
    return jwt.sign(payload, requireEnv("JWT_SECRET"), {
        expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const token =
        req.cookies?.proexam_token ||
        (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const secret = requireEnv("JWT_SECRET");
        const decoded = jwt.verify(token, secret) as any;
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            fullName: decoded.fullName,
        };
        next();
    } catch (err: any) {
        // Missing JWT_SECRET on the server -> treat as a 500, not a 401,
        // so the root cause is obvious rather than a fake "invalid token".
        if (err instanceof Error && /JWT_SECRET/i.test(err.message)) {
            return res.status(500).json({ error: "Server misconfigured: JWT_SECRET missing" });
        }
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

export function requireRole(
    ...roles: ("admin" | "teacher" | "student")[]
) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!roles.includes(req.user.role)) {
            return res
                .status(403)
                .json({ error: "Forbidden: insufficient role" });
        }
        next();
    };
}
