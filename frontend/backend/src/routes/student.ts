import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../database/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

router.use(authenticate, requireRole("student"));

// ============================================================
// DASHBOARD STATS
// ============================================================
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;

        const [classes, exams, results] = await Promise.all([
            query(
                `SELECT c.id, c.name, c.subject, c.description, tu.full_name as teacher_name
         FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         LEFT JOIN users tu ON tu.id = c.teacher_id
         WHERE cs.student_id = $1 AND cs.removed_at IS NULL`,
                [studentProfileId]
            ),
            query(
                `SELECT e.id, e.title, e.subject, e.status, e.start_at, e.end_at, e.duration_minutes,
                 c.name as class_name,
                 (SELECT 1 FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.student_id = $2) as has_attempt
          FROM exams e
          LEFT JOIN classes c ON c.id = e.class_id
          WHERE e.class_id IN (SELECT class_id FROM class_students WHERE student_id = $1 AND removed_at IS NULL)
            AND e.status IN ('scheduled', 'active', 'completed', 'published')
          ORDER BY e.start_at DESC`,
                [studentProfileId, studentProfileId]
            ),
            query(
                `SELECT r.*, e.title as exam_title FROM results r
         JOIN exams e ON e.id = r.exam_id
         WHERE r.student_id = $1 AND r.published_at IS NOT NULL
         ORDER BY r.created_at DESC`,
                [studentProfileId]
            ),
        ]);

        res.json({
            classes: classes.rows,
            exams: exams.rows,
            results: results.rows,
            totalClasses: classes.rows.length,
            totalExams: exams.rows.length,
            publishedResults: results.rows.length,
        });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// MY CLASSES
// ============================================================
router.get("/classes", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;

        const result = await query(
            `SELECT c.id, c.name, c.subject, c.description, c.status, c.created_at,
              tu.full_name as teacher_name,
              (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id AND cs.removed_at IS NULL) as total_students
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       LEFT JOIN users tu ON tu.id = c.teacher_id
       WHERE cs.student_id = $1 AND cs.removed_at IS NULL
       ORDER BY c.name`,
            [studentProfileId]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// MY EXAMS
// ============================================================
router.get("/exams", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, type } = req.query;
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;

        // Stable query shape: $1/$2 = student, $3 = status, $4 = type.
        const result = await query(
            `SELECT e.id, e.title, e.subject, e.description, e.status,
               e.start_at, e.end_at, e.duration_minutes, e.total_marks, e.passing_marks,
               c.name as class_name, tu.full_name as teacher_name,
               ea.id as attempt_id, ea.status as attempt_status,
               ea.total_obtained_marks, ea.percentage, ea.passed,
               r.published_at as result_published_at
                FROM exams e
                LEFT JOIN classes c ON c.id = e.class_id
                LEFT JOIN users tu ON tu.id = e.teacher_id
                LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.student_id = $2
                LEFT JOIN results r ON r.attempt_id = ea.id
                WHERE e.class_id IN (SELECT class_id FROM class_students WHERE student_id = $1 AND removed_at IS NULL)
                  AND ($3::text IS NULL OR e.status = $3)
                  AND (
                    $4::text IS NULL
                    OR ($4 = 'upcoming' AND e.start_at > NOW() AND e.status IN ('scheduled', 'active'))
                    OR ($4 = 'available' AND e.status = 'active' AND ea.status IS NULL)
                    OR ($4 = 'completed' AND ea.status IN ('submitted', 'auto_submitted', 'marking', 'completed'))
                    OR ($4 = 'results' AND r.published_at IS NOT NULL)
                  )
                ORDER BY e.start_at DESC`,
            [studentProfileId, studentProfileId, (status as string) || null, type as string || null]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// MY RESULTS (published only)
// ============================================================
// Detailed result with question-by-question breakdown for the student.
// Query param: resultId
router.get("/results/detail", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { resultId } = req.query;
        if (!resultId) throw new ApiError(400, "resultId is required");

        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;

        const res0 = await query(
            `SELECT r.*, e.title as exam_title, e.subject as exam_subject,
              u.full_name as student_name
             FROM results r
             JOIN exams e ON e.id = r.exam_id
             JOIN users u ON u.id = r.student_id
             WHERE r.id = $1 AND r.student_id = $2 AND r.published_at IS NOT NULL`,
            [resultId, studentProfileId]
        );
        if (res0.rows.length === 0) throw new ApiError(404, "Result not found");
        const result = res0.rows[0];

        const attemptRes = await query(
            "SELECT * FROM exam_attempts WHERE id = $1",
            [result.attempt_id]
        );
        if (attemptRes.rows.length === 0) throw new ApiError(404, "Attempt not found");
        const attempt = attemptRes.rows[0];

        const answersRes = await query(
            `SELECT sa.id AS answer_id, sa.answer_text, sa.selected_option_ids,
              sa.is_correct, sa.marks_awarded, sa.feedback,
              eq.position, q.id AS question_id, q.text AS question_text, q.type, q.marks, q.correct_answer
             FROM student_answers sa
             JOIN exam_attempt_questions eq ON eq.id = sa.attempt_question_id
             JOIN questions q ON q.id = eq.question_id
             WHERE sa.attempt_id = $1
             ORDER BY eq.position`,
            [attempt.id]
        );

        const qIds = answersRes.rows.map((r: any) => r.question_id).filter(Boolean);
        let optionsByQuestion: Record<string, any[]> = {};
        if (qIds.length > 0) {
            const optRes = await query(
                `SELECT qo.question_id, qo.id AS option_id, qo.label,
                  qo.text AS option_text, qo.is_correct
                 FROM question_options qo
                 WHERE qo.question_id = ANY($1::uuid[])
                 ORDER BY qo.question_id, qo.sort_order`,
                [qIds]
            );
            for (const o of optRes.rows as any[]) {
                if (!optionsByQuestion[o.question_id]) optionsByQuestion[o.question_id] = [];
                optionsByQuestion[o.question_id].push({
                    id: o.option_id,
                    label: o.label,
                    text: o.option_text,
                    is_correct: o.is_correct,
                });
            }
        }

        const breakdown = answersRes.rows.map((r: any) => ({
            ...r,
            options: optionsByQuestion[r.question_id] || [],
        }));

        res.json({
            result,
            attempt: {
                id: attempt.id,
                status: attempt.status,
                submitted_at: attempt.submitted_at,
                auto_submitted: attempt.auto_submitted,
            },
            breakdown,
        });
    } catch (err) {
        next(err);
    }
});

router.get("/results", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;

        const result = await query(
            `SELECT r.*, e.title as exam_title, e.subject as exam_subject, e.start_at as exam_date
       FROM results r
       JOIN exams e ON e.id = r.exam_id
       WHERE r.student_id = $1 AND r.published_at IS NOT NULL
       ORDER BY r.published_at DESC`,
            [studentProfileId]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// MY PROFILE
// ============================================================
router.get("/profile", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT u.id, u.email, u.full_name, u.status, u.is_active, u.last_login_at,
              sp.student_id, sp.date_of_birth, sp.gender, sp.address, sp.phone, sp.avatar_url
       FROM users u
       JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
            [req.user!.id]
        );

        if (result.rows.length === 0) throw new ApiError(404, "Profile not found");

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// UPDATE PROFILE
// ============================================================
const updateProfileSchema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
});

router.patch("/profile", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateProfileSchema.parse(req.body);

        if (data.fullName) {
            await query("UPDATE users SET full_name = $1 WHERE id = $2", [
                data.fullName,
                req.user!.id,
            ]);
        }
        if (data.phone || data.address) {
            await query(
                `UPDATE student_profiles SET
           phone = COALESCE($1, phone),
           address = COALESCE($2, address)
         WHERE user_id = $3`,
                [data.phone, data.address, req.user!.id]
            );
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// CHANGE PASSWORD
// ============================================================
const changePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(6),
});

router.post("/profile/password", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = changePasswordSchema.parse(req.body);
        const bcrypt = await import("bcryptjs");

        const result = await query("SELECT password_hash FROM users WHERE id = $1", [
            req.user!.id,
        ]);
        const valid = await bcrypt.default.compare(
            data.currentPassword,
            result.rows[0].password_hash
        );
        if (!valid) throw new ApiError(400, "Current password is incorrect");

        const newHash = await bcrypt.default.hash(data.newPassword, 12);
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
            newHash,
            req.user!.id,
        ]);

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
