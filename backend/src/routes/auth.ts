import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool, query, withTransaction } from "../database/index.js";
import { generateToken, authenticate } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const registerStudentSchema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    studentId: z.string().optional(),
    phone: z.string().optional(),
});

// POST /api/auth/login (also exposed at /api/auth for compatibility)
router.post(["/", "/login"], async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const result = await query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            throw new ApiError(401, "Invalid email or password");
        }

        const user: any = result.rows[0];

        if (!user.is_active) {
            throw new ApiError(403, "Account is deactivated. Please contact admin.");
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            throw new ApiError(401, "Invalid email or password");
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
        });

        res.cookie("proexam_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Update last login
        await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent)
       VALUES ($1, 'login', 'user', $2, $3)`,
            [
                user.id,
                req.ip || req.socket?.remoteAddress,
                req.get("user-agent"),
            ]
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
            },
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/register (public — students self-register)
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = registerStudentSchema.parse(req.body);
        const passwordHash = await bcrypt.hash(data.password, 12);

        const existing = await query("SELECT id FROM users WHERE email = $1", [data.email]);
        if (existing.rows.length > 0) {
            throw new ApiError(409, "An account with this email already exists");
        }

        const result = await withTransaction(async (client: any) => {
            const userRes = await client.query(
                `INSERT INTO users (email, password_hash, full_name, role, status, is_active)
         VALUES ($1, $2, $3, 'student', 'active', TRUE) RETURNING id, email, full_name, role`,
                [data.email, passwordHash, data.fullName]
            );
            const userId = userRes.rows[0].id;

            await client.query(
                `INSERT INTO student_profiles (user_id, student_id, phone)
         VALUES ($1, $2, $3)`,
                [userId, data.studentId || null, data.phone || null]
            );

            await client.query(
                `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'student_registered', 'user', $2, $3)`,
                [userId, userId, JSON.stringify({ email: data.email, fullName: data.fullName })]
            );

            return userRes.rows[0];
        });

        // Auto-login: issue a token for the new student
        const token = generateToken({
            id: result.id,
            email: result.email,
            role: "student",
            fullName: result.full_name,
        });

        res.status(201).cookie("proexam_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            token,
            user: {
                id: result.id,
                email: result.email,
                role: result.role,
                fullName: result.full_name,
            },
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.clearCookie("proexam_token");

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent)
       VALUES ($1, 'logout', 'user', $2, $3)`,
            [
                req.user!.id,
                req.ip || req.socket?.remoteAddress,
                req.get("user-agent"),
            ]
        );

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT u.id, u.email, u.full_name, u.role, u.status, u.is_active, u.last_login_at,
              tp.* FROM users u
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE u.id = $1`,
            [req.user!.id]
        );

        if (result.rows.length === 0) {
            throw new ApiError(404, "User not found");
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            status: user.status,
            isActive: user.is_active,
            lastLoginAt: user.last_login_at,
            profile: user,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/change-password
const changePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(6),
});

router.post("/change-password", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = changePasswordSchema.parse(req.body);
        const result = await query("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
        if (result.rows.length === 0) throw new ApiError(404, "User not found");

        const valid = await bcrypt.compare(data.currentPassword, result.rows[0].password_hash);
        if (!valid) throw new ApiError(400, "Current password is incorrect");

        const newHash = await bcrypt.hash(data.newPassword, 12);
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user!.id]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
