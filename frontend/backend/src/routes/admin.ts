import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, withTransaction } from "../database/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole("admin"));

// ============================================================
// DASHBOARD STATS
// ============================================================
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [students, teachers, classes, exams, activeExams, completedExams, publishedResults] =
            await Promise.all([
                query("SELECT COUNT(*)::int as count FROM users WHERE role = 'student'"),
                query("SELECT COUNT(*)::int as count FROM users WHERE role = 'teacher'"),
                query("SELECT COUNT(*)::int as count FROM classes"),
                query("SELECT COUNT(*)::int as count FROM exams"),
                query("SELECT COUNT(*)::int as count FROM exams WHERE status = 'active'"),
                query(
                    "SELECT COUNT(*)::int as count FROM exams WHERE status IN ('completed', 'published')"
                ),
                query("SELECT COUNT(*)::int as count FROM results WHERE published_at IS NOT NULL"),
            ]);

        res.json({
            totalStudents: students.rows[0].count,
            totalTeachers: teachers.rows[0].count,
            totalClasses: classes.rows[0].count,
            totalExams: exams.rows[0].count,
            activeExams: activeExams.rows[0].count,
            completedExams: completedExams.rows[0].count,
            publishedResults: publishedResults.rows[0].count,
        });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// USERS (all roles)
// ============================================================

const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(2),
    role: z.enum(["admin", "teacher", "student"]),
    employeeId: z.string().optional(),
    studentId: z.string().optional(),
});

// GET /api/admin/users
router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { role, search, status, page = "1", limit = "50" } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // Stable query shape: $1=role, $2=status, $3=search, $4=limit, $5=offset.
        const result = await query(
            `SELECT u.id, u.email, u.full_name, u.role, u.status, u.is_active, u.last_login_at, u.created_at,
               tp.employee_id, tp.department,
               sp.student_id, sp.date_of_birth
                FROM users u
                LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
                LEFT JOIN student_profiles sp ON sp.user_id = u.id
                WHERE ($1::text IS NULL OR u.role = $1)
                  AND ($2::text IS NULL OR u.status = $2)
                  AND ($3::text IS NULL OR u.email ILIKE $3 OR u.full_name ILIKE $3)
                ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`,
            [
                (role as string) || null,
                (status as string) || null,
                search ? `%${search}%` : null,
                Number(limit),
                offset,
            ]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/admin/users
router.post("/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createUserSchema.parse(req.body);
        const passwordHash = await bcrypt.hash(data.password, 12);

        const result = await withTransaction(async (client: any) => {
            const userRes = await client.query(
                `INSERT INTO users (email, password_hash, full_name, role, status, is_active)
         VALUES ($1, $2, $3, $4, 'active', TRUE) RETURNING id, email, full_name, role`,
                [data.email, passwordHash, data.fullName, data.role]
            );
            const userId = userRes.rows[0].id;

            if (data.role === "teacher") {
                await client.query(
                    `INSERT INTO teacher_profiles (user_id, employee_id) VALUES ($1, $2)`,
                    [userId, data.employeeId]
                );
            } else if (data.role === "student") {
                await client.query(
                    `INSERT INTO student_profiles (user_id, student_id) VALUES ($1, $2)`,
                    [userId, data.studentId]
                );
            }

            await client.query(
                `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'user_created', 'user', $2, $3)`,
                [req.user!.id, userId, JSON.stringify(data)]
            );

            return userRes.rows[0];
        });

        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/users/:id
const updateUserSchema = z.object({
    fullName: z.string().min(2).optional(),
    role: z.enum(["admin", "teacher", "student"]).optional(),
    status: z.enum(["active", "inactive", "suspended"]).optional(),
});

router.patch("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateUserSchema.parse(req.body);
        const userId = req.params.id;

        if (data.status === "inactive" && userId === req.user!.id) {
            throw new ApiError(400, "You cannot deactivate your own account");
        }

        const sets: string[] = [];
        const params: any[] = [];
        for (const [key, value] of Object.entries(data)) {
            if (key === "status") {
                params.push(value, value === "active" ? true : false);
                sets.push(`status = $${params.length - 1}`, `is_active = $${params.length}`);
            } else {
                params.push(value);
                sets.push(`${key} = $${params.length}`);
            }
        }
        params.push(userId);

        const result = await query(
            `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING id, email, full_name, role, status, is_active`,
            params
        );

        if (result.rows.length === 0) throw new ApiError(404, "User not found");

        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'user_updated', 'user', $2, $3)`,
            [req.user!.id, userId, JSON.stringify(data)]
        );

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.id;
        if (userId === req.user!.id) {
            throw new ApiError(400, "You cannot delete your own account");
        }

        const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
        if (result.rows.length === 0) throw new ApiError(404, "User not found");

        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'user_deleted', 'user', $2, '{}')`,
            [req.user!.id, userId]
        );

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// TEACHERS
// ============================================================

// GET /api/admin/teachers
router.get("/teachers", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, status } = req.query;
        // Stable query shape: $1=status, $2=search.
        const result = await query(
            `SELECT u.id, u.email, u.full_name, u.role, u.status, u.is_active, u.last_login_at, u.created_at,
               tp.employee_id, tp.department, tp.specialization
                FROM users u
                JOIN teacher_profiles tp ON tp.user_id = u.id
                WHERE u.role = 'teacher'
                  AND ($1::text IS NULL OR u.status = $1)
                  AND ($2::text IS NULL OR u.email ILIKE $2 OR u.full_name ILIKE $2 OR tp.employee_id ILIKE $2)
                ORDER BY u.created_at DESC`,
            [(status as string) || null, search ? `%${search}%` : null]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// STUDENTS
// ============================================================

// GET /api/admin/students
router.get("/students", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, status } = req.query;
        // Stable query shape: $1=status, $2=search.
        const result = await query(
            `SELECT u.id, u.email, u.full_name, u.role, u.status, u.is_active, u.last_login_at, u.created_at,
               sp.student_id, sp.date_of_birth, sp.gender
                FROM users u
                JOIN student_profiles sp ON sp.user_id = u.id
                WHERE u.role = 'student'
                  AND ($1::text IS NULL OR u.status = $1)
                  AND ($2::text IS NULL OR u.email ILIKE $2 OR u.full_name ILIKE $2 OR sp.student_id ILIKE $2)
                ORDER BY u.created_at DESC`,
            [(status as string) || null, search ? `%${search}%` : null]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// CLASSES
// ============================================================

// GET /api/admin/classes
router.get("/classes", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT c.*, tu.full_name as teacher_name,
              (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id AND cs.removed_at IS NULL) as student_count
       FROM classes c
       LEFT JOIN users tu ON tu.id = c.teacher_id
       ORDER BY c.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/classes/:id
router.get("/classes/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT c.*, tu.full_name as teacher_name, tu.email as teacher_email
       FROM classes c
       LEFT JOIN users tu ON tu.id = c.teacher_id
       WHERE c.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) throw new ApiError(404, "Class not found");
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// POST /api/admin/classes
const createClassSchema = z.object({
    name: z.string().min(1),
    subject: z.string().optional(),
    description: z.string().optional(),
    teacherId: z.string().optional(),
});

router.post("/classes", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createClassSchema.parse(req.body);

        const result = await query(
            `INSERT INTO classes (name, subject, description, teacher_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [data.name, data.subject, data.description, data.teacherId]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'class_created', 'class', $2, $3)`,
            [req.user!.id, result.rows[0].id, JSON.stringify(data)]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/classes/:id
router.patch("/classes/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createClassSchema.partial().parse(req.body);
        const classId = req.params.id;

        const sets: string[] = [];
        const params: any[] = [];
        for (const [key, value] of Object.entries(data)) {
            const col = key === "teacherId" ? "teacher_id" : key;
            params.push(value);
            sets.push(`${col} = $${params.length}`);
        }
        params.push(classId);

        const result = await query(
            `UPDATE classes SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
            params
        );

        if (result.rows.length === 0) throw new ApiError(404, "Class not found");
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/classes/:id
router.delete("/classes/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query("DELETE FROM classes WHERE id = $1 RETURNING id", [
            req.params.id,
        ]);
        if (result.rows.length === 0) throw new ApiError(404, "Class not found");

        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'class_deleted', 'class', $2, '{}')`,
            [req.user!.id, req.params.id]
        );

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// AUDIT LOGS
// ============================================================

// GET /api/admin/audit-logs
router.get("/audit-logs", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { action, entityType, from, to, page = "1", limit = "100" } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // Stable query shape: $1=action, $2=entityType, $3=from, $4=to, $5=limit, $6=offset.
        const result = await query(
            `SELECT al.*, u.full_name as actor_name, u.email as actor_email
                FROM audit_logs al
                LEFT JOIN users u ON u.id = al.user_id
                WHERE ($1::text IS NULL OR al.action = $1)
                  AND ($2::text IS NULL OR al.entity_type = $2)
                  AND ($3::text IS NULL OR al.created_at >= $3::timestamptz)
                  AND ($4::text IS NULL OR al.created_at <= $4::timestamptz)
                ORDER BY al.created_at DESC LIMIT $5 OFFSET $6`,
            [
                (action as string) || null,
                (entityType as string) || null,
                (from as string) || null,
                (to as string) || null,
                Number(limit),
                offset,
            ]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// SYSTEM SETTINGS (admin)
// ============================================================
router.get("/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            "SELECT key, value, description FROM system_settings ORDER BY key"
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

export default router;
