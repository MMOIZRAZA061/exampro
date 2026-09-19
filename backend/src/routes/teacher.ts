import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, withTransaction } from "../database/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

// All teacher routes require authentication + teacher/admin role
router.use(authenticate, requireRole("admin", "teacher"));

// Helper: return the teacher's own user id (teacher_profiles.user_id == users.id
// in this schema; the FK is teacher_profiles.user_id -> users.id). When a
// teacher creates an entity we store the user id directly in the *_id column,
// so this simply resolves to the current user id.
async function getTeacherId(userId: string): Promise<string> {
    return userId;
}

// ============================================================
// DASHBOARD STATS
// ============================================================
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const [students, classes, exams, activeExams, upcomingExams, pendingMarking, publishedResults] =
            await Promise.all([
                query(
                    `SELECT COUNT(*)::int as count
                     FROM class_students cs
                     JOIN classes c ON c.id = cs.class_id
                     WHERE c.teacher_id = $1 AND cs.removed_at IS NULL`,
                    [teacherUserId]
                ),
                query(
                    "SELECT COUNT(*)::int as count FROM classes WHERE teacher_id = $1 AND status = 'active'",
                    [teacherUserId]
                ),
                query(
                    "SELECT COUNT(*)::int as count FROM exams WHERE teacher_id = $1",
                    [teacherUserId]
                ),
                query(
                    "SELECT COUNT(*)::int as count FROM exams WHERE teacher_id = $1 AND status = 'active'",
                    [teacherUserId]
                ),
                query(
                    `SELECT COUNT(*)::int as count FROM exams
                     WHERE teacher_id = $1 AND status IN ('scheduled', 'active') AND start_at > NOW()`,
                    [teacherUserId]
                ),
                query(
                    `SELECT COUNT(DISTINCT ea.id)::int as count
                     FROM exam_attempts ea
                     JOIN exams e ON e.id = ea.exam_id
                     WHERE e.teacher_id = $1 AND ea.status = 'submitted'`,
                    [teacherUserId]
                ),
                query(
                    `SELECT COUNT(*)::int as count FROM results r
                     JOIN exams e ON e.id = r.exam_id
                     WHERE e.teacher_id = $1 AND r.published_at IS NOT NULL`,
                    [teacherUserId]
                ),
            ]);

        res.json({
            totalStudents: students.rows[0].count,
            totalClasses: classes.rows[0].count,
            totalExams: exams.rows[0].count,
            activeExams: activeExams.rows[0].count,
            upcomingExams: upcomingExams.rows[0].count,
            pendingMarking: pendingMarking.rows[0].count,
            publishedResults: publishedResults.rows[0].count,
        });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// STUDENTS
// ============================================================
// GET /teachers/students
router.get("/students", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, classId } = req.query;

        const teacherUserId = await getTeacherId(req.user!.id);

        const classFilter = classId
            ? `AND cs.class_id = $3`
            : `AND cs.class_id IN (SELECT c2.id FROM classes c2 WHERE c2.teacher_id = $3)`;

        const result = await query(
            `SELECT u.id, u.full_name, u.email, u.status,
                    sp.student_id, sp.phone,
                    c.name as class_name, c.id as class_id
             FROM users u
             JOIN student_profiles sp ON sp.user_id = u.id
             JOIN class_students cs ON cs.student_id = sp.user_id AND cs.removed_at IS NULL
             JOIN classes c ON c.id = cs.class_id
             WHERE ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
               ${classFilter}
             ORDER BY u.full_name`,
            [search as string || null, null, teacherUserId]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// GET /teachers/students/:id
router.get("/students/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                    sp.student_id, sp.date_of_birth, sp.gender, sp.address, sp.phone,
                    tp.department, tp.specialization
             FROM users u
             JOIN student_profiles sp ON sp.user_id = u.id
             LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
             WHERE u.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) throw new ApiError(404, "Student not found");

        const classesRes = await query(
            `SELECT c.* FROM class_students cs
             JOIN classes c ON c.id = cs.class_id
             WHERE cs.student_id = $1 AND cs.removed_at IS NULL`,
            [result.rows[0].id]
        );

        res.json({ ...result.rows[0], classes: classesRes.rows });
    } catch (err) {
        next(err);
    }
});

// POST /teachers/students
router.post("/students", async (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        studentId: z.string().optional(),
        phone: z.string().optional(),
    });
    const data = schema.parse(req.body);

    try {
        const passwordHash = await bcrypt.hash(data.password, 10);
        const result = await withTransaction(async (client: any) => {
            const userRes = await client.query(
                `INSERT INTO users (email, password_hash, full_name, role, status)
                 VALUES ($1, $2, $3, 'student', 'active')
                 RETURNING id`,
                [data.email, passwordHash, data.fullName]
            );
            const userId = userRes.rows[0].id;

            await client.query(
                `INSERT INTO student_profiles (user_id, student_id, phone)
                 VALUES ($1, $2, $3)`,
                [userId, data.studentId || null, data.phone || null]
            );

            return userRes.rows[0];
        });
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
});

// POST /teachers/students/:id/assign-to-class
router.post("/students/:id/assign-to-class", async (req: Request, res: Response, next: NextFunction) => {
    const { classId } = z.object({ classId: z.string() }).parse(req.body);

    try {
        await withTransaction(async (client: any) => {
            const studentProfile = await client.query(
                "SELECT user_id FROM student_profiles WHERE user_id = $1",
                [req.params.id]
            );
            if (studentProfile.rows.length === 0) throw new ApiError(404, "Student not found");
            const studentProfileId = studentProfile.rows[0].user_id;

            await client.query(
                `INSERT INTO class_students (class_id, student_id)
                 VALUES ($1, $2)
                 ON CONFLICT (class_id, student_id) DO UPDATE SET removed_at = NULL`,
                [classId, studentProfileId]
            );
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// CLASSES
// ============================================================
// GET /teachers/classes
router.get("/classes", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `SELECT c.*,
                    (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id AND cs.removed_at IS NULL) as student_count
             FROM classes c
             WHERE c.teacher_id = $1 AND c.status != 'archived'
             ORDER BY c.name`,
            [teacherUserId]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /teachers/classes
router.post("/classes", async (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({
        name: z.string().min(2),
        subject: z.string().optional(),
        description: z.string().optional(),
    });
    const data = schema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `INSERT INTO classes (name, subject, description, teacher_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, subject, description, status, created_at`,
            [data.name, data.subject || null, data.description || null, teacherUserId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// GET /teachers/classes/:id
router.get("/classes/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT c.*,
                    (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id AND cs.removed_at IS NULL) as student_count
             FROM classes c
             WHERE c.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) throw new ApiError(404, "Class not found");
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PATCH /teachers/classes/:id
router.patch("/classes/:id", async (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({
        name: z.string().optional(),
        subject: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        status: z.enum(["active", "inactive", "archived"]).optional(),
    });
    const data = schema.parse(req.body);

    try {
        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(data)) {
            fields.push(`${key} = $${values.length + 2}`);
            values.push(val);
        }
        if (fields.length === 0) throw new ApiError(400, "No fields to update");
        values.push(req.params.id);

        const result = await query(
            `UPDATE classes SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (result.rows.length === 0) throw new ApiError(404, "Class not found");
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// GET /teachers/classes/:id/members
router.get("/classes/:id/members", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT u.id, u.full_name, u.email, u.status,
                    sp.student_id, sp.phone
             FROM class_students cs
             JOIN student_profiles sp ON sp.user_id = cs.student_id
             JOIN users u ON u.id = sp.user_id
             WHERE cs.class_id = $1 AND cs.removed_at IS NULL
             ORDER BY u.full_name`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// QUESTION BANKS
// ============================================================
// GET /teachers/question-banks
router.get("/question-banks", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, subject } = req.query;
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `SELECT qb.*, tu.full_name as teacher_name,
                    (SELECT COUNT(*)::int FROM questions q WHERE q.question_bank_id = qb.id) as question_count_live
             FROM question_banks qb
             LEFT JOIN users tu ON tu.id = qb.teacher_id
             WHERE qb.teacher_id = $1
               AND ($2::text IS NULL OR qb.name ILIKE '%' || $2 || '%')
               AND ($3::text IS NULL OR qb.subject ILIKE '%' || $3 || '%')
             ORDER BY qb.created_at DESC`,
            [teacherUserId, (search as string) || null, (subject as string) || null]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /teachers/question-banks
router.post("/question-banks", async (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({
        name: z.string().min(2),
        subject: z.string().optional(),
        description: z.string().optional(),
    });
    const data = schema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `INSERT INTO question_banks (name, subject, description, teacher_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [data.name, data.subject || null, data.description || null, teacherUserId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// GET /teachers/question-banks/:id
router.get("/question-banks/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            `SELECT qb.*, tu.full_name as teacher_name,
                    (SELECT COUNT(*)::int FROM questions q WHERE q.question_bank_id = qb.id) as question_count_live
             FROM question_banks qb
             LEFT JOIN users tu ON tu.id = qb.teacher_id
             WHERE qb.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) throw new ApiError(404, "Question bank not found");
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PATCH /teachers/question-banks/:id
router.patch("/question-banks/:id", async (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({
        name: z.string().min(2).optional(),
        subject: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);

    try {
        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(data)) {
            fields.push(`${key} = $${values.length + 2}`);
            values.push(val);
        }
        if (fields.length === 0) throw new ApiError(400, "No fields to update");
        values.push(req.params.id);

        const result = await query(
            `UPDATE question_banks SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (result.rows.length === 0) throw new ApiError(404, "Question bank not found");
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /teachers/question-banks/:id
router.delete("/question-banks/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await query(
            "DELETE FROM question_banks WHERE id = $1 RETURNING id",
            [req.params.id]
        );
        if (result.rows.length === 0) throw new ApiError(404, "Question bank not found");
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// QUESTION IMPORT (simple line-based .txt)
// ============================================================

// Parse simple .txt text where each non-empty line = one question.
// Lines starting with a letter + "." or ")" are inline options for
// the preceding question (e.g. "A) Paris", "B) London").
interface ParsedQuestion {
    text: string;
    inlineOptions?: { label: string; text: string }[];
}

function parseSimpleQuestions(raw: string): ParsedQuestion[] {
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    const questions: ParsedQuestion[] = [];
    let current: ParsedQuestion | null = null;

    for (const line of lines) {
        const optMatch = /^([A-Ha-h])[\.\)]\s+(.+)$/.exec(line);
        if (optMatch && current) {
            if (!current.inlineOptions) current.inlineOptions = [];
            current.inlineOptions.push({
                label: optMatch[1].toUpperCase(),
                text: optMatch[2].trim(),
            });
        } else {
            current = { text: line };
            questions.push(current);
        }
    }
    return questions;
}

// POST /teachers/question-banks/import
router.post("/question-banks/import", async (req: Request, res: Response, next: NextFunction) => {
    const importSchema = z.object({
        fileContent: z.string().min(1),
        fileName: z.string().min(1),
        bankId: z.string().optional().nullable(),
        name: z.string().min(2).optional(),
        subject: z.string().optional(),
        description: z.string().optional(),
        questionType: z
            .enum(["mcq", "multi_choice", "true_false", "short_answer", "long_answer", "fill_blank"])
            .default("short_answer"),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        marks: z.number().int().min(0).default(1),
        options: z
            .array(
                z.object({
                    label: z.string().min(1),
                    text: z.string().min(1),
                })
            )
            .optional(),
        correctAnswer: z.string().optional().nullable(),
        explanation: z.string().optional().nullable(),
    });

    const data = importSchema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        // Resolve target bank
        let bankId = data.bankId;
        let bankName: string;

        if (bankId) {
            const existing = await query(
                "SELECT id, name, teacher_id FROM question_banks WHERE id = $1",
                [bankId]
            );
            if (existing.rows.length === 0) throw new ApiError(404, "Target question bank not found");
            if (existing.rows[0].teacher_id !== teacherUserId)
                throw new ApiError(403, "You do not own this question bank");
            bankName = existing.rows[0].name;
        } else {
            bankName = data.name || data.fileName.replace(/\.txt$/i, "");
            const created = await query(
                `INSERT INTO question_banks (name, subject, description, teacher_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [bankName, data.subject || null, data.description || null, teacherUserId]
            );
            bankId = created.rows[0].id;
        }

        // Parse text
        const parsed = parseSimpleQuestions(data.fileContent);
        if (parsed.length === 0)
            throw new ApiError(400, "No questions found in file");

        // Build option list (GUI-provided options apply to every question;
        // inline options from text can extend per-question if desired, but
        // the current design applies uniform GUI options to all questions.)
        const baseOptions: { label: string; text: string }[] =
            data.options && data.options.length > 0
                ? data.options
                : parsed[0].inlineOptions
                    ? parsed[0].inlineOptions
                    : [];

        // Determine correct answer option ID (by label or text match).
        // We compute the correct label after inserting, so do it later.

        let imported = 0;
        let skipped = 0;
        const errors: { question: string; reason: string }[] = [];

        await withTransaction(async (client: any) => {
            for (const q of parsed) {
                // Use the question's inline options if present, else the GUI options
                const optsForQ = q.inlineOptions && q.inlineOptions.length > 0
                    ? q.inlineOptions
                    : baseOptions;

                const qRes = await client.query(
                    `INSERT INTO questions
                        (question_bank_id, text, type, difficulty, marks, correct_answer, explanation, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING id`,
                    [
                        bankId,
                        q.text,
                        data.questionType,
                        data.difficulty,
                        data.marks,
                        data.correctAnswer || null,
                        data.explanation || null,
                        JSON.stringify({ sourceFile: data.fileName }),
                    ]
                );
                const questionId = qRes.rows[0].id;

                // Insert options
                for (let i = 0; i < optsForQ.length; i++) {
                    const opt = optsForQ[i];
                    let isCorrect = false;
                    if (data.correctAnswer) {
                        isCorrect =
                            opt.label === data.correctAnswer ||
                            opt.text.trim() === data.correctAnswer.trim();
                    }
                    await client.query(
                        `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [questionId, opt.label, opt.text, isCorrect, i]
                    );
                }

                imported++;
            }

            // Update bank question count
            const countRes = await client.query(
                "SELECT COUNT(*)::int as count FROM questions WHERE question_bank_id = $1",
                [bankId]
            );
            await client.query(
                "UPDATE question_banks SET question_count = $1, updated_at = NOW() WHERE id = $2",
                [countRes.rows[0].count, bankId]
            );
        });

        res.status(201).json({
            bank: { id: bankId, name: bankName },
            imported,
            skipped,
            errors,
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /teachers/students/:id/from-class/:classId
router.delete("/students/:id/from-class/:classId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, classId } = req.params;
        await withTransaction(async (client: any) => {
            const studentProfile = await client.query(
                "SELECT user_id FROM student_profiles WHERE user_id = $1",
                [id]
            );
            if (studentProfile.rows.length === 0) throw new ApiError(404, "Student not found");
            const studentProfileId = studentProfile.rows[0].user_id;

            await client.query(
                "UPDATE class_students SET removed_at = NOW() WHERE class_id = $1 AND student_id = $2 AND removed_at IS NULL",
                [classId, studentProfileId]
            );
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// QUESTIONS CRUD
// ============================================================
// GET /teachers/questions
router.get("/questions", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bankId, type, difficulty, category, search } = req.query;
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `SELECT q.*, qb.name as bank_name,
                    (SELECT COUNT(*)::int FROM question_options qo WHERE qo.question_id = q.id) as option_count
             FROM questions q
             JOIN question_banks qb ON qb.id = q.question_bank_id
             WHERE qb.teacher_id = $1
               AND ($2::uuid IS NULL OR q.question_bank_id = $2)
               AND ($3::text IS NULL OR q.type = $3)
               AND ($4::text IS NULL OR q.difficulty = $4)
               AND ($5::text IS NULL OR q.category ILIKE '%' || $5 || '%')
               AND ($6::text IS NULL OR q.text ILIKE '%' || $6 || '%')
             ORDER BY q.created_at DESC
             LIMIT 500`,
            [
                teacherUserId,
                (bankId as string) || null,
                (type as string) || null,
                (difficulty as string) || null,
                (category as string) || null,
                (search as string) || null,
            ]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /teachers/questions
router.post("/questions", async (req: Request, res: Response, next: NextFunction) => {
    const questionSchema = z.object({
        questionBankId: z.string().min(1),
        text: z.string().min(1),
        type: z.enum(["mcq", "multi_choice", "true_false", "short_answer", "long_answer", "fill_blank"]),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        marks: z.number().int().min(0).default(1),
        category: z.string().optional(),
        correctAnswer: z.string().optional().nullable(),
        explanation: z.string().optional().nullable(),
        options: z
            .array(
                z.object({
                    label: z.string().min(1),
                    text: z.string().min(1),
                    isCorrect: z.boolean().optional(),
                })
            )
            .optional(),
    });
    const data = questionSchema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        // Verify the bank belongs to the teacher
        const bankCheck = await query(
            "SELECT id FROM question_banks WHERE id = $1 AND teacher_id = $2",
            [data.questionBankId, teacherUserId]
        );
        if (bankCheck.rows.length === 0) throw new ApiError(403, "Question bank not found or not owned");

        const result = await withTransaction(async (client: any) => {
            const qRes = await client.query(
                `INSERT INTO questions
                    (question_bank_id, text, type, difficulty, marks, category, correct_answer, explanation, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [
                    data.questionBankId,
                    data.text,
                    data.type,
                    data.difficulty,
                    data.marks,
                    data.category || null,
                    data.correctAnswer || null,
                    data.explanation || null,
                    JSON.stringify({}),
                ]
            );
            const questionId = qRes.rows[0].id;

            // Insert options
            if (data.options && data.options.length > 0) {
                for (let i = 0; i < data.options.length; i++) {
                    const opt = data.options[i];
                    await client.query(
                        `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [questionId, opt.label, opt.text, opt.isCorrect || false, i]
                    );
                }
            }

            return qRes.rows[0];
        });
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
});

// GET /teachers/questions/:id
router.get("/questions/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const qRes = await query(
            `SELECT q.*, qb.name as bank_name
             FROM questions q
             JOIN question_banks qb ON qb.id = q.question_bank_id
             WHERE q.id = $1`,
            [req.params.id]
        );
        if (qRes.rows.length === 0) throw new ApiError(404, "Question not found");

        const optRes = await query(
            "SELECT * FROM question_options WHERE question_id = $1 ORDER BY sort_order",
            [req.params.id]
        );

        res.json({ ...qRes.rows[0], options: optRes.rows });
    } catch (err) {
        next(err);
    }
});

// PATCH /teachers/questions/:id
router.patch("/questions/:id", async (req: Request, res: Response, next: NextFunction) => {
    const questionSchema = z.object({
        text: z.string().min(1).optional(),
        type: z.enum(["mcq", "multi_choice", "true_false", "short_answer", "long_answer", "fill_blank"]).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        marks: z.number().int().min(0).optional(),
        category: z.string().optional().nullable(),
        correctAnswer: z.string().optional().nullable(),
        explanation: z.string().optional().nullable(),
        options: z
            .array(
                z.object({
                    label: z.string().min(1),
                    text: z.string().min(1),
                    isCorrect: z.boolean().optional(),
                })
            )
            .optional(),
    });
    const data = questionSchema.parse(req.body);

    try {
        const result = await withTransaction(async (client: any) => {
            const fields: string[] = [];
            const values: any[] = [];
            const fieldMap: Record<string, string> = {
                text: "text",
                type: "type",
                difficulty: "difficulty",
                marks: "marks",
                category: "category",
                correctAnswer: "correct_answer",
                explanation: "explanation",
            };
            for (const [key, col] of Object.entries(fieldMap)) {
                if (key in data && data[key as keyof typeof data] !== undefined) {
                    fields.push(`${col} = $${values.length + 2}`);
                    values.push(data[key as keyof typeof data] as any);
                }
            }
            if (fields.length > 0) {
                values.push(req.params.id);
                await client.query(
                    `UPDATE questions SET ${fields.join(", ")} WHERE id = $${values.length}`,
                    values
                );
            }

            // Replace options if provided
            if (data.options !== undefined) {
                await client.query("DELETE FROM question_options WHERE question_id = $1", [req.params.id]);
                for (let i = 0; i < data.options!.length; i++) {
                    const opt = data.options![i];
                    await client.query(
                        `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [req.params.id, opt.label, opt.text, opt.isCorrect || false, i]
                    );
                }
            }

            const updated = await client.query("SELECT * FROM questions WHERE id = $1", [req.params.id]);
            const opts = await client.query(
                "SELECT * FROM question_options WHERE question_id = $1 ORDER BY sort_order",
                [req.params.id]
            );
            return { ...updated.rows[0], options: opts.rows };
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// DELETE /teachers/questions/:id
router.delete("/questions/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        await query("DELETE FROM questions WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// EXAMS
// ============================================================
// GET /teachers/exams
router.get("/exams", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status } = req.query;
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `SELECT e.*,
                    c.name as class_name, qb.name as bank_name,
                    (SELECT COUNT(*)::int FROM exam_attempts ea WHERE ea.exam_id = e.id) as attempt_count
             FROM exams e
             LEFT JOIN classes c ON c.id = e.class_id
             LEFT JOIN question_banks qb ON qb.id = e.question_bank_id
             WHERE e.teacher_id = $1
               AND ($2::text IS NULL OR e.status = $2)
             ORDER BY e.created_at DESC`,
            [teacherUserId, (status as string) || null]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /teachers/exams
router.post("/exams", async (req: Request, res: Response, next: NextFunction) => {
    const examSchema = z.object({
        title: z.string().min(2),
        subject: z.string().optional(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        classId: z.string().nullable().optional(),
        questionBankId: z.string().min(1),
        durationMinutes: z.number().int().min(1).default(60),
        totalMarks: z.number().int().min(0).default(100),
        passingMarks: z.number().int().min(0).default(50),
        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),
        status: z.enum(["draft", "scheduled", "active"]).default("draft"),
        questionsPerStudent: z.number().int().min(1).default(20),
        allowedCategories: z.array(z.string()).optional(),
        allowedDifficulties: z.array(z.enum(["easy", "medium", "hard"])).optional(),
        shuffleQuestions: z.boolean().default(true),
        shuffleOptions: z.boolean().default(true),
        requireFullscreen: z.boolean().default(false),
        restrictCopy: z.boolean().default(true),
        restrictPaste: z.boolean().default(true),
        maxViolations: z.number().int().min(0).default(3),
        autoSubmitOnViolations: z.boolean().default(true),
    });
    const data = examSchema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        // Validate question bank
        const bankCheck = await query(
            "SELECT id, teacher_id FROM question_banks WHERE id = $1",
            [data.questionBankId]
        );
        if (bankCheck.rows.length === 0)
            throw new ApiError(404, "Question bank not found");
        if (bankCheck.rows[0].teacher_id !== teacherUserId)
            throw new ApiError(403, "You do not own this question bank");

        // Validate class if provided
        if (data.classId) {
            const classCheck = await query(
                "SELECT id FROM classes WHERE id = $1 AND teacher_id = $2",
                [data.classId, teacherUserId]
            );
            if (classCheck.rows.length === 0)
                throw new ApiError(403, "Class not found or not owned");
        }

        // Default time window
        let startAt = data.startAt || null;
        let endAt = data.endAt || null;
        if (!startAt) {
            startAt = new Date().toISOString();
        }
        if (!endAt && startAt) {
            const startDate = new Date(startAt);
            startDate.setMinutes(startDate.getMinutes() + data.durationMinutes);
            endAt = startDate.toISOString();
        }

        const result = await query(
            `INSERT INTO exams
                (title, subject, description, instructions, class_id, question_bank_id,
                 teacher_id, duration_minutes, total_marks, passing_marks, start_at, end_at,
                 status, questions_per_student, allowed_categories, allowed_difficulties,
                 shuffle_questions, shuffle_options,
                 require_fullscreen, restrict_copy, restrict_paste,
                 max_violations, auto_submit_on_violations)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
             RETURNING *`,
            [
                data.title,
                data.subject || null,
                data.description || null,
                data.instructions || null,
                data.classId || null,
                data.questionBankId,
                teacherUserId,
                data.durationMinutes,
                data.totalMarks,
                data.passingMarks,
                startAt,
                endAt,
                data.status,
                data.questionsPerStudent,
                data.allowedCategories ? JSON.stringify(data.allowedCategories) : null,
                data.allowedDifficulties ? JSON.stringify(data.allowedDifficulties) : null,
                data.shuffleQuestions,
                data.shuffleOptions,
                data.requireFullscreen,
                data.restrictCopy,
                data.restrictPaste,
                data.maxViolations,
                data.autoSubmitOnViolations,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// GET /teachers/exams/:id
router.get("/exams/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            `SELECT e.*, c.name as class_name, qb.name as bank_name,
                    (SELECT COUNT(*)::int FROM exam_attempts ea WHERE ea.exam_id = e.id) as attempt_count,
                    (SELECT COUNT(*)::int FROM results r WHERE r.exam_id = e.id AND r.published_at IS NOT NULL) as published_count
             FROM exams e
             LEFT JOIN classes c ON c.id = e.class_id
             LEFT JOIN question_banks qb ON qb.id = e.question_bank_id
             WHERE e.id = $1 AND e.teacher_id = $2`,
            [req.params.id, teacherUserId]
        );
        if (result.rows.length === 0) throw new ApiError(404, "Exam not found");

        const questionsRes = await query(
            `SELECT q.id, q.text, q.type, q.marks, q.difficulty, q.category
             FROM exam_questions eq
             JOIN questions q ON q.id = eq.question_id
             WHERE eq.exam_id = $1
             ORDER BY eq.position`,
            [req.params.id]
        );

        res.json({ ...result.rows[0], questions: questionsRes.rows });
    } catch (err) {
        next(err);
    }
});

// PATCH /teachers/exams/:id
router.patch("/exams/:id", async (req: Request, res: Response, next: NextFunction) => {
    const examSchema = z.object({
        title: z.string().min(2).optional(),
        subject: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        instructions: z.string().optional().nullable(),
        classId: z.string().nullable().optional(),
        questionBankId: z.string().min(1).optional(),
        durationMinutes: z.number().int().min(1).optional(),
        totalMarks: z.number().int().min(0).optional(),
        passingMarks: z.number().int().min(0).optional(),
        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),
        questionsPerStudent: z.number().int().min(1).optional(),
        allowedCategories: z.array(z.string()).optional().nullable(),
        allowedDifficulties: z.array(z.enum(["easy", "medium", "hard"])).optional().nullable(),
        shuffleQuestions: z.boolean().optional(),
        shuffleOptions: z.boolean().optional(),
        requireFullscreen: z.boolean().optional(),
        restrictCopy: z.boolean().optional(),
        restrictPaste: z.boolean().optional(),
        maxViolations: z.number().int().min(0).optional(),
        autoSubmitOnViolations: z.boolean().optional(),
    });
    const data = examSchema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const verifyRes = await query(
            "SELECT id FROM exams WHERE id = $1 AND teacher_id = $2",
            [req.params.id, teacherUserId]
        );
        if (verifyRes.rows.length === 0) throw new ApiError(404, "Exam not found or not owned");

        const fieldMap: Record<string, string> = {
            title: "title",
            subject: "subject",
            description: "description",
            instructions: "instructions",
            classId: "class_id",
            questionBankId: "question_bank_id",
            durationMinutes: "duration_minutes",
            totalMarks: "total_marks",
            passingMarks: "passing_marks",
            startAt: "start_at",
            endAt: "end_at",
            questionsPerStudent: "questions_per_student",
            allowedCategories: "allowed_categories",
            allowedDifficulties: "allowed_difficulties",
            shuffleQuestions: "shuffle_questions",
            shuffleOptions: "shuffle_options",
            requireFullscreen: "require_fullscreen",
            restrictCopy: "restrict_copy",
            restrictPaste: "restrict_paste",
            maxViolations: "max_violations",
            autoSubmitOnViolations: "auto_submit_on_violations",
        };

        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, col] of Object.entries(fieldMap)) {
            if (key in data && data[key as keyof typeof data] !== undefined) {
                let val = data[key as keyof typeof data];
                if (key === "allowedCategories" && Array.isArray(val))
                    val = val ? JSON.stringify(val) : null;
                if (key === "allowedDifficulties" && Array.isArray(val))
                    val = val ? JSON.stringify(val) : null;
                fields.push(`${col} = $${values.length + 2}`);
                values.push(val);
            }
        }
        if (fields.length === 0) throw new ApiError(400, "No fields to update");
        values.push(req.params.id);

        const result = await query(
            `UPDATE exams SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
            values
        );
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PATCH /teachers/exams/:id/status
router.patch("/exams/:id/status", async (req: Request, res: Response, next: NextFunction) => {
    const statusSchema = z.object({
        status: z.enum(["draft", "scheduled", "active", "completed", "published", "archived"]),
    });
    const { status } = statusSchema.parse(req.body);

    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const verifyRes = await query(
            "SELECT id, status, start_at, end_at, duration_minutes FROM exams WHERE id = $1 AND teacher_id = $2",
            [req.params.id, teacherUserId]
        );
        if (verifyRes.rows.length === 0)
            throw new ApiError(404, "Exam not found or not owned");

        const current = verifyRes.rows[0];
        const fields: string[] = ["status = $1"];
        const values: any[] = [status];

        // When transitioning to "active", fill in start_at/end_at if missing
        if (status === "active") {
            if (!current.start_at) {
                fields.push("start_at = $2");
                values.push(new Date().toISOString());
            }
            if (!current.end_at) {
                const base = current.start_at
                    ? new Date(current.start_at as string)
                    : new Date();
                base.setMinutes(base.getMinutes() + (current.duration_minutes || 60));
                fields.push(`end_at = $${fields.length}`);
                values.push(base.toISOString());
            }
        }
        values.push(req.params.id);

        const result = await query(
            `UPDATE exams SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
            values
        );
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /teachers/exams/:id
router.delete("/exams/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const result = await query(
            "DELETE FROM exams WHERE id = $1 AND teacher_id = $2 RETURNING id",
            [req.params.id, teacherUserId]
        );
        if (result.rows.length === 0)
            throw new ApiError(404, "Exam not found or not owned");
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// ATTEMPTS
// ============================================================

/**
 * GET /attempts
 * Query params:
 *   - status: optional filter (submitted, completed, in_progress, ...)
 *   - examId: optional filter by exam
 * Returns attempts for the current teacher's exams.
 */
router.get("/attempts", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);
        const { status, examId } = req.query as { status?: string; examId?: string };

        // Build WHERE clause dynamically
        const conditions: string[] = ["e.teacher_id = $1"];
        const params: any[] = [teacherUserId];
        let paramIdx = 2;

        if (status) {
            conditions.push(`a.status = $${paramIdx++}`);
            params.push(status);
        }
        if (examId) {
            conditions.push(`a.exam_id = $${paramIdx++}`);
            params.push(examId);
        }

        const whereClause = conditions.join(" AND ");

        const result = await query(
            `SELECT a.*, e.title AS exam_title, e.subject AS exam_subject,
              u.full_name AS student_name, sp.student_id AS student_roll
             FROM exam_attempts a
             JOIN exams e ON e.id = a.exam_id
             JOIN users u ON u.id = a.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
             WHERE ${whereClause}
             ORDER BY a.started_at DESC`,
            params
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /attempts/:id
 * Returns full attempt details including answers with marks_awarded.
 */
router.get("/attempts/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);

        const attemptRes = await query(
            `SELECT a.*, e.title AS exam_title, e.subject AS exam_subject,
              u.full_name AS student_name, sp.student_id AS student_roll
             FROM exam_attempts a
             JOIN exams e ON e.id = a.exam_id
             JOIN users u ON u.id = a.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
             WHERE a.id = $1 AND e.teacher_id = $2`,
            [req.params.id, teacherUserId]
        );
        if (attemptRes.rows.length === 0)
            throw new ApiError(404, "Attempt not found or not owned");
        const attempt = attemptRes.rows[0];

        // Fetch all answers for this attempt
        const answersRes = await query(
            `SELECT sa.id AS answer_id, sa.attempt_question_id, sa.answer_text,
              sa.selected_option_ids, sa.is_correct, sa.marks_awarded, sa.feedback,
              sa.marked_by, sa.marked_at,
              eq.position, q.id AS question_id, q.text AS question_text,
              q.type, q.marks AS max_marks, q.correct_answer, q.explanation
             FROM student_answers sa
             JOIN exam_attempt_questions eq ON eq.id = sa.attempt_question_id
             JOIN questions q ON q.id = eq.question_id
             WHERE sa.attempt_id = $1
             ORDER BY eq.position`,
            [attempt.id]
        );

        // Fetch options for questions that have them
        const qIds = answersRes.rows
            .map((r: any) => r.question_id)
            .filter(Boolean);
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
                if (!optionsByQuestion[o.question_id])
                    optionsByQuestion[o.question_id] = [];
                optionsByQuestion[o.question_id].push({
                    id: o.option_id,
                    label: o.label,
                    text: o.option_text,
                    is_correct: o.is_correct,
                });
            }
        }

        // Normalise JSON-ish fields (selected_option_ids / correct_answer) into
        // arrays so the client can rely on a stable contract regardless of the
        // underlying Postgres column type (jsonb vs text).
        const normaliseIdField = (v: any): any[] => {
            if (v == null) return [];
            if (Array.isArray(v)) return v;
            if (typeof v === "string") {
                try {
                    const parsed = JSON.parse(v);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    return v ? [v] : [];
                }
            }
            return [v];
        };

        const answers = answersRes.rows.map((r: any) => ({
            ...r,
            selected_option_ids: normaliseIdField(r.selected_option_ids),
            correct_answer: r.correct_answer
                ? normaliseIdField(r.correct_answer)
                : null,
            options: optionsByQuestion[r.question_id] || [],
        }));

        res.json({
            ...attempt,
            student_id: attempt.student_id,
            answers,
        });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// MARKING
// ============================================================

/**
 * POST /attempts/:id/mark
 * Body: { answerId: string, marksAwarded: number, feedback?: string }
 * Updates a single answer's marks, recalculates attempt totals,
 * and upserts into results table.
 */
router.post(
    "/attempts/:id/mark",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherUserId = await getTeacherId(req.user!.id);
            const { answerId, marksAwarded, feedback } = req.body as {
                answerId: string;
                marksAwarded: number;
                feedback?: string;
            };

            if (!answerId)
                throw new ApiError(400, "answerId is required");

            // Verify attempt ownership
            const attemptRes = await query(
                `SELECT a.id, a.exam_id, a.student_id
                 FROM exam_attempts a
                 JOIN exams e ON e.id = a.exam_id
                 WHERE a.id = $1 AND e.teacher_id = $2`,
                [req.params.id, teacherUserId]
            );
            if (attemptRes.rows.length === 0)
                throw new ApiError(404, "Attempt not found or not owned");
            const attempt = attemptRes.rows[0];

            // Update the answer
            await query(
                `UPDATE student_answers
                 SET marks_awarded = $1, feedback = $2, marked_by = $3, marked_at = NOW()
                 WHERE id = $4 AND attempt_id = $5`,
                [
                    marksAwarded,
                    feedback ?? null,
                    teacherUserId,
                    answerId,
                    attempt.id,
                ]
            );

            // Recalculate totals for this attempt
            const totalsRes = await query(
                `SELECT COALESCE(SUM(COALESCE(sa.marks_awarded, 0)), 0) AS total_obtained,
                  COALESCE(SUM(q.marks), 0) AS total_possible
                 FROM student_answers sa
                 JOIN exam_attempt_questions eq ON eq.id = sa.attempt_question_id
                 JOIN questions q ON q.id = eq.question_id
                 WHERE sa.attempt_id = $1`,
                [attempt.id]
            );
            const totalObtained = Number(totalsRes.rows[0]?.total_obtained ?? 0);
            const totalPossible = Number(totalsRes.rows[0]?.total_possible ?? 0);
            const percentage =
                totalPossible > 0
                    ? Math.round((totalObtained / totalPossible) * 10000) / 100
                    : 0;

            // Fetch exam to determine passing. Pass/fail is decided by
            // percentage: the student passes when their obtained percentage
            // reaches the exam's passing threshold (passing_marks as a % of
            // the exam total_marks). This fixes the "full marks still shows
            // Fail" bug that happened when passing_marks was compared against
            // raw obtained marks instead of a percentage threshold.
            const examRes = await query(
                "SELECT total_marks, passing_marks FROM exams WHERE id = $1",
                [attempt.exam_id]
            );
            const examTotalMarks = Number(
                examRes.rows[0]?.total_marks ?? totalPossible
            );
            const examPassingMarks = Number(
                examRes.rows[0]?.passing_marks ?? 0
            );
            const passingPercentage =
                examTotalMarks > 0
                    ? Math.round((examPassingMarks / examTotalMarks) * 10000) / 100
                    : 0;
            const passed =
                totalPossible > 0 ? percentage >= passingPercentage : false;

            // Update attempt
            await query(
                `UPDATE exam_attempts
                 SET total_obtained_marks = $1, total_possible_marks = $2,
                     percentage = $3, passed = $4
                 WHERE id = $5`,
                [totalObtained, totalPossible, percentage, passed, attempt.id]
            );

            // Upsert result
            await query(
                `INSERT INTO results (attempt_id, student_id, exam_id, total_marks,
                   obtained_marks, percentage, passed)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (attempt_id) DO UPDATE
                 SET total_marks = $4, obtained_marks = $5,
                     percentage = $6, passed = $7, updated_at = NOW()`,
                [
                    attempt.id,
                    attempt.student_id,
                    attempt.exam_id,
                    totalPossible,
                    totalObtained,
                    percentage,
                    passed,
                ]
            );

            res.json({ success: true, totalObtained, totalPossible, percentage, passed });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * POST /attempts/:id/finalize
 * Sets attempt status to 'completed'.
 */
router.post(
    "/attempts/:id/finalize",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherUserId = await getTeacherId(req.user!.id);

            const result = await query(
                `UPDATE exam_attempts a SET status = 'completed'
                 FROM exams e
                 WHERE a.id = $1 AND e.id = a.exam_id AND e.teacher_id = $2
                 RETURNING a.id`,
                [req.params.id, teacherUserId]
            );
            if (result.rows.length === 0)
                throw new ApiError(404, "Attempt not found or not owned");

            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

// ============================================================
// RESULTS
// ============================================================

/**
 * GET /results/detail
 * Query params: resultId (required), studentId (optional — if omitted,
 * any of the current teacher's results can be viewed)
 */
router.get("/results/detail", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { resultId, studentId } = req.query as {
            resultId?: string;
            studentId?: string;
        };
        if (!resultId) throw new ApiError(400, "resultId is required");

        const teacherUserId = await getTeacherId(req.user!.id);

        // Build the query: if studentId is provided, filter by it; otherwise
        // just verify the result belongs to one of the teacher's exams.
        let sql: string;
        let params: any[];
        if (studentId) {
            sql = `SELECT r.*, e.title AS exam_title, e.subject AS exam_subject,
              u.full_name AS student_name
             FROM results r
             JOIN exams e ON e.id = r.exam_id
             JOIN users u ON u.id = r.student_id
             WHERE r.id = $1 AND r.student_id = $2 AND e.teacher_id = $3`;
            params = [resultId, studentId, teacherUserId];
        } else {
            sql = `SELECT r.*, e.title AS exam_title, e.subject AS exam_subject,
              u.full_name AS student_name
             FROM results r
             JOIN exams e ON e.id = r.exam_id
             JOIN users u ON u.id = r.student_id
             WHERE r.id = $1 AND e.teacher_id = $2`;
            params = [resultId, teacherUserId];
        }

        const res0 = await query(sql, params);
        if (res0.rows.length === 0)
            throw new ApiError(404, "Result not found or not owned");
        const result = res0.rows[0];

        // Fetch the associated attempt
        const attemptRes = await query(
            "SELECT * FROM exam_attempts WHERE id = $1",
            [result.attempt_id]
        );
        if (attemptRes.rows.length === 0)
            throw new ApiError(404, "Attempt not found");
        const attempt = attemptRes.rows[0];

        // Fetch answers with marks
        const answersRes = await query(
            `SELECT sa.id AS answer_id, sa.answer_text, sa.selected_option_ids,
              sa.is_correct, sa.marks_awarded, sa.feedback,
              eq.position, q.id AS question_id, q.text AS question_text,
              q.type, q.marks, q.correct_answer
             FROM student_answers sa
             JOIN exam_attempt_questions eq ON eq.id = sa.attempt_question_id
             JOIN questions q ON q.id = eq.question_id
             WHERE sa.attempt_id = $1
             ORDER BY eq.position`,
            [attempt.id]
        );

        // Fetch options
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
                if (!optionsByQuestion[o.question_id])
                    optionsByQuestion[o.question_id] = [];
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

/**
 * GET /results
 * Query params: examId (optional)
 * Lists all results for the current teacher's exams.
 */
router.get("/results", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teacherUserId = await getTeacherId(req.user!.id);
        const { examId } = req.query as { examId?: string };

        let sql: string;
        let params: any[];
        if (examId) {
            sql = `SELECT r.*, e.title AS exam_title, e.subject AS exam_subject,
              u.full_name AS student_name, sp.student_id AS student_roll
             FROM results r
             JOIN exams e ON e.id = r.exam_id
             JOIN users u ON u.id = r.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = r.student_id
             WHERE r.exam_id = $1 AND e.teacher_id = $2
             ORDER BY r.created_at DESC`;
            params = [examId, teacherUserId];
        } else {
            sql = `SELECT r.*, e.title AS exam_title, e.subject AS exam_subject,
              u.full_name AS student_name, sp.student_id AS student_roll
             FROM results r
             JOIN exams e ON e.id = r.exam_id
             JOIN users u ON u.id = r.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = r.student_id
             WHERE e.teacher_id = $1
             ORDER BY r.created_at DESC`;
            params = [teacherUserId];
        }

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /results/:id/publish
 * Body: { teacherFeedback?: string }
 * Marks the result as published.
 */
router.post(
    "/results/:id/publish",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherUserId = await getTeacherId(req.user!.id);
            const { teacherFeedback } = req.body as { teacherFeedback?: string };

            const result = await query(
                `UPDATE results r SET published_at = NOW(), published_by = $1,
                  teacher_feedback = COALESCE($2, r.teacher_feedback)
                 FROM exams e
                 WHERE r.id = $3 AND e.id = r.exam_id AND e.teacher_id = $4
                 RETURNING r.id`,
                [teacherUserId, teacherFeedback ?? null, req.params.id, teacherUserId]
            );
            if (result.rows.length === 0)
                throw new ApiError(404, "Result not found or not owned");

            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * PATCH /results/:id
 * Body: { teacherFeedback?: string, grade?: string }
 */
router.patch(
    "/results/:id",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherUserId = await getTeacherId(req.user!.id);
            const { teacherFeedback, grade } = req.body as {
                teacherFeedback?: string;
                grade?: string;
            };

            const result = await query(
                `UPDATE results r SET
                  teacher_feedback = COALESCE($1, r.teacher_feedback),
                  grade = COALESCE($2, r.grade),
                  updated_at = NOW()
                 FROM exams e
                 WHERE r.id = $3 AND e.id = r.exam_id AND e.teacher_id = $4
                 RETURNING r.id`,
                [teacherFeedback ?? null, grade ?? null, req.params.id, teacherUserId]
            );
            if (result.rows.length === 0)
                throw new ApiError(404, "Result not found or not owned");

            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
