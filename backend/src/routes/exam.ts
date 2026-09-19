import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { query, withTransaction } from "../database/index.js";
import { authenticate } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

router.use(authenticate);

// ============================================================
// START EXAM
// POST /api/exams/:id/start
// Student starts an exam. Creates attempt, assigns randomized questions.
// ============================================================
router.post("/:id/start", async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.role !== "student") {
        throw new ApiError(403, "Only students can start exams");
    }

    try {
        const examId = req.params.id;
        const studentUserId = req.user!.id;

        // Get student's user_id in student_profiles
        const studentProfile = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [studentUserId]
        );
        if (studentProfile.rows.length === 0) {
            throw new ApiError(404, "Student profile not found");
        }
        const studentProfileId = studentProfile.rows[0].user_id;

        // Verify the student is in a class associated with this exam
        const classCheck = await query(
            `SELECT 1 FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.student_id = $1 AND c.id IN (
         SELECT class_id FROM exams WHERE id = $2 AND class_id IS NOT NULL
       ) AND cs.removed_at IS NULL`,
            [studentProfileId, examId]
        );

        const examRes = await query("SELECT * FROM exams WHERE id = $1", [examId]);
        if (examRes.rows.length === 0) throw new ApiError(404, "Exam not found");
        const exam: any = examRes.rows[0];

        // Check exam status
        if (exam.status !== "active" && exam.status !== "scheduled") {
            throw new ApiError(400, "Exam is not currently available");
        }

        // Check if exam is within its time window.
        // If start_at and end_at are the same instant (no real window set by the
        // teacher), fall back to: the exam is open from start_at to start_at + duration.
        const now = new Date();
        const startAt = exam.start_at ? new Date(exam.start_at) : null;
        const endAt = exam.end_at ? new Date(exam.end_at) : null;
        const hasNoWindow = startAt && endAt && startAt.getTime() === endAt.getTime();

        if (startAt && !hasNoWindow && now < startAt) {
            throw new ApiError(400, "Exam has not started yet");
        }
        if (endAt && !hasNoWindow && now > endAt) {
            throw new ApiError(400, "Exam has ended");
        }

        // Check if student already has an attempt.
        // - in_progress: resume it (idempotent).
        // - completed: only block when a result has actually been published,
        //   a submitted attempt (even unpublished) also blocks re-entry,
        //   because exam_attempts enforces UNIQUE(exam_id, student_id) and
        //   a student may only have one attempt per exam.
        const existing = await query(
            `SELECT ea.id, ea.status FROM exam_attempts ea
              WHERE ea.exam_id = $1 AND ea.student_id = $2
              ORDER BY ea.started_at DESC`,
            [examId, studentProfileId]
        );
        if (existing.rows.length > 0) {
            const attempt = existing.rows[0];
            if (attempt.status === "in_progress") {
                // Return the existing attempt - student is resuming
                const attemptDetails = await getAttemptDetails(attempt.id, studentProfileId);
                return res.json({ ...attemptDetails, resumed: true });
            }
            // Any terminal status (submitted / auto_submitted / completed / marking)
            // means the student already has a finished attempt. Because
            // exam_attempts enforces UNIQUE(exam_id, student_id) a student may
            // only have one attempt per exam, so block re-entry.
            if (
                attempt.status === "submitted" ||
                attempt.status === "auto_submitted" ||
                attempt.status === "completed" ||
                attempt.status === "marking"
            ) {
                throw new ApiError(400, "You have already submitted this exam");
            }
        }

        // Create attempt and assign questions
        const attempt = await withTransaction(async (client: any) => {
            const nowISO = new Date().toISOString();
            const deadlineISO = new Date(
                new Date().getTime() + exam.duration_minutes * 60 * 1000
            ).toISOString();

            // Create exam attempt
            const attemptRes = await client.query(
                `INSERT INTO exam_attempts (exam_id, student_id, started_at, deadline_at, status)
         VALUES ($1, $2, $3, $4, 'in_progress') RETURNING *`,
                [examId, studentProfileId, nowISO, deadlineISO]
            );
            const attemptId = attemptRes.rows[0].id;

            // Select questions from the question bank based on rules.
            // Stable query shape: $1=bank, $2=categories[], $3=difficulties[], $4=limit.
            // NULL arrays simply don't match, so omitted filters are no-ops.
            const selectedQuestions = await client.query(
                `SELECT q.id FROM questions q
                 WHERE q.question_bank_id = $1
                   AND ($2::varchar[] IS NULL OR q.category = ANY($2))
                   AND ($3::varchar[] IS NULL OR q.difficulty = ANY($3))
                 ORDER BY random() LIMIT $4`,
                [
                    exam.question_bank_id,
                    exam.allowed_categories && exam.allowed_categories.length > 0
                        ? exam.allowed_categories
                        : null,
                    exam.allowed_difficulties && exam.allowed_difficulties.length > 0
                        ? exam.allowed_difficulties
                        : null,
                    exam.questions_per_student,
                ]
            );

            // If not enough questions, fill with remaining
            if (selectedQuestions.rows.length < exam.questions_per_student) {
                const remaining = await client.query(
                    `SELECT q.id FROM questions q
           WHERE q.question_bank_id = $1 AND q.id NOT IN (SELECT q2.id FROM questions q2 WHERE q2.id = ANY($2::uuid[]))
           ORDER BY random() LIMIT $3`,
                    [
                        exam.question_bank_id,
                        selectedQuestions.rows.map((r: any) => r.id),
                        exam.questions_per_student - selectedQuestions.rows.length,
                    ]
                );
                selectedQuestions.rows.push(...remaining.rows);
            }

            // Assign questions to attempt
            const shuffledQuestionIds = exam.shuffle_questions
                ? shuffleArray(selectedQuestions.rows.map((r: any) => r.id))
                : selectedQuestions.rows.map((r: any) => r.id);

            for (let i = 0; i < shuffledQuestionIds.length; i++) {
                await client.query(
                    `INSERT INTO exam_attempt_questions (attempt_id, question_id, position)
           VALUES ($1, $2, $3)`,
                    [attemptId, shuffledQuestionIds[i], i]
                );

                // Create answer placeholder
                await client.query(
                    `INSERT INTO student_answers (attempt_question_id, attempt_id, student_id, last_saved_at)
           SELECT eq2.id, $1, $2, NOW()
           FROM exam_attempt_questions eq2
           WHERE eq2.attempt_id = $1 AND eq2.question_id = $3`,
                    [attemptId, studentProfileId, shuffledQuestionIds[i]]
                );
            }

            return attemptRes.rows[0];
        });

        // Log security event
        await query(
            `INSERT INTO security_events (attempt_id, student_id, event_type, description)
       VALUES ($1, $2, 'exam_submitted', 'Exam started')`,
            [attempt.id, studentProfileId]
        );

        const attemptDetails = await getAttemptDetails(attempt.id, studentProfileId);
        res.status(201).json({ ...attemptDetails, resumed: false });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET ATTEMPT
// GET /api/exams/:id/attempt
// ============================================================
router.get("/:id/attempt", async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.role !== "student") {
        throw new ApiError(403, "Only students can view their attempts");
    }

    try {
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        if (studentProfileRes.rows.length === 0) {
            throw new ApiError(404, "Student profile not found");
        }

        const attemptRes = await query(
            `SELECT ea.*, e.title as exam_title FROM exam_attempts ea
       JOIN exams e ON e.id = ea.exam_id
       WHERE ea.exam_id = $1 AND ea.student_id = $2`,
            [req.params.id, studentProfileRes.rows[0].user_id]
        );

        if (attemptRes.rows.length === 0) {
            throw new ApiError(404, "No attempt found for this exam");
        }

        const details = await getAttemptDetails(attemptRes.rows[0].id, studentProfileRes.rows[0].user_id);
        res.json(details);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// SAVE ANSWER (Auto-save)
// POST /api/exams/:id/answers
// ============================================================
router.post("/:id/answers", async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.role !== "student") {
        throw new ApiError(403, "Only students can save answers");
    }

    const { attemptQuestionId, answerText, selectedOptionIds, markForReview } = req.body;

    if (!attemptQuestionId) {
        throw new ApiError(400, "attemptQuestionId is required");
    }

    try {
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;
        if (!studentProfileId) throw new ApiError(404, "Student profile not found");

        // Verify this question belongs to the student's attempt
        const eqRes = await query(
            `SELECT eqa.id, eqa.attempt_id FROM exam_attempt_questions eqa
       WHERE eqa.id = $1`,
            [attemptQuestionId]
        );
        if (eqRes.rows.length === 0) {
            throw new ApiError(404, "Question not found in your attempt");
        }

        const attemptId = eqRes.rows[0].attempt_id;

        // Verify student owns this attempt
        const attemptCheck = await query(
            "SELECT 1 FROM exam_attempts WHERE id = $1 AND student_id = $2",
            [attemptId, studentProfileId]
        );
        if (attemptCheck.rows.length === 0) {
            throw new ApiError(403, "Access denied: this attempt belongs to another student");
        }

        // Check attempt is still in progress
        const attemptStatus = await query(
            "SELECT status, deadline_at FROM exam_attempts WHERE id = $1",
            [attemptId]
        );
        if (attemptStatus.rows[0].status !== "in_progress") {
            throw new ApiError(400, "Exam is no longer in progress");
        }

        // Check deadline
        if (new Date() > new Date(attemptStatus.rows[0].deadline_at)) {
            throw new ApiError(400, "Exam has expired");
        }

        // Upsert the answer
        await query(
            `INSERT INTO student_answers (attempt_question_id, attempt_id, student_id, answer_text, selected_option_ids, last_saved_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (attempt_question_id, student_id) DO UPDATE SET
         answer_text = COALESCE(EXCLUDED.answer_text, student_answers.answer_text),
         selected_option_ids = COALESCE(EXCLUDED.selected_option_ids, student_answers.selected_option_ids),
         last_saved_at = NOW()`,
            [
                attemptQuestionId,
                attemptId,
                studentProfileId,
                answerText ?? null,
                selectedOptionIds ? JSON.stringify(selectedOptionIds) : null,
            ]
        );

        res.json({ success: true, lastSavedAt: new Date().toISOString() });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// SUBMIT EXAM
// POST /api/exams/:id/submit
// ============================================================
const submitSchema = z.object({
    attemptId: z.string(),
    reason: z.enum(["manual", "auto", "violations"]).optional(),
});

router.post("/:id/submit", async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.role !== "student") {
        throw new ApiError(403, "Only students can submit exams");
    }

    try {
        const { attemptId, reason } = submitSchema.parse(req.body);
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;
        if (!studentProfileId) throw new ApiError(404, "Student profile not found");

        // Verify ownership
        const attemptCheck = await query(
            "SELECT 1 FROM exam_attempts WHERE id = $1 AND student_id = $2",
            [attemptId, studentProfileId]
        );
        if (attemptCheck.rows.length === 0) {
            throw new ApiError(403, "Access denied: this attempt belongs to another student");
        }

        // Idempotency guard: if the attempt was already finalised by an
        // earlier submit call (duplicate request after a network timeout, or
        // a race between the auto timer and a manual submit), return success
        // instead of running the finalisation / scoring a second time.
        const statusCheck = await query(
            "SELECT status FROM exam_attempts WHERE id = $1",
            [attemptId]
        );
        if (statusCheck.rows.length === 0 || statusCheck.rows[0].status !== "in_progress") {
            res.json({ success: true, alreadySubmitted: true });
            return;
        }

        const isAuto = reason === "auto" || reason === "violations";

        // Auto-mark objective questions, update attempt totals, upsert result
        await finalizeAttemptSubmission(attemptId, isAuto);

        // Log security event
        await query(
            `INSERT INTO security_events (attempt_id, student_id, event_type, description)
   VALUES ($1, $2, 'exam_submitted', $3)`,
            [attemptId, studentProfileId, isAuto ? "Auto-submitted (time expired)" : "Manually submitted"]
        );

        res.json({ success: true, autoSubmitted: isAuto });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// REPORT SECURITY EVENT
// POST /api/exams/:id/security-event
// ============================================================
const securityEventSchema = z.object({
    eventType: z.enum([
        "focus_lost",
        "tab_switched",
        "visibility_changed",
        "exam_left",
        "exam_returned",
        "copy_attempt",
        "paste_attempt",
        "fullscreen_exited",
        "violation",
    ]),
    description: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

router.post("/:id/security-event", async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.role !== "student") {
        throw new ApiError(403, "Only students can report security events");
    }

    try {
        const { eventType, description, metadata } = securityEventSchema.parse(req.body);
        const studentProfileRes = await query(
            "SELECT user_id FROM student_profiles WHERE user_id = $1",
            [req.user!.id]
        );
        const studentProfileId = studentProfileRes.rows[0]?.user_id;
        if (!studentProfileId) throw new ApiError(404, "Student profile not found");

        // Find the student's active attempt
        const attemptRes = await query(
            `SELECT id, violation_count FROM exam_attempts
       WHERE exam_id = $1 AND student_id = $2 AND status = 'in_progress'`,
            [req.params.id, studentProfileId]
        );

        if (attemptRes.rows.length === 0) {
            throw new ApiError(404, "No active attempt found");
        }

        const attempt = attemptRes.rows[0];
        const newViolationCount = attempt.violation_count + 1;

        // Update violation count
        await query(
            `UPDATE exam_attempts SET violation_count = $1 WHERE id = $2`,
            [newViolationCount, attempt.id]
        );

        // Log security event
        await query(
            `INSERT INTO security_events (attempt_id, student_id, event_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [
                attempt.id,
                studentProfileId,
                eventType,
                description,
                metadata ? JSON.stringify(metadata) : null,
            ]
        );

        // Check if auto-submit should trigger
        const examRes = await query(
            "SELECT max_violations, auto_submit_on_violations FROM exams WHERE id = $1",
            [req.params.id]
        );
        const examConfig = examRes.rows[0];

        let shouldAutoSubmit = false;
        if (
            examConfig.auto_submit_on_violations &&
            newViolationCount >= examConfig.max_violations
        ) {
            shouldAutoSubmit = true;
            // Force auto-submit AND run the full marking + result pipeline,
            // exactly like a manual "violations" submit, so the exam is
            // actually graded instead of just flipping the status.
            await finalizeAttemptSubmission(attempt.id, true);
        }

        res.json({
            success: true,
            violationCount: newViolationCount,
            shouldAutoSubmit,
        });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Runs the full submission pipeline for an attempt: marks objective
 * questions, stores totals on the attempt, upserts the results row,
 * and normalises the status to "submitted". Used by both the manual
 * submit endpoint and the security-event auto-submit path so that a
 * violation-triggered submission is graded exactly like a normal one.
 */
async function finalizeAttemptSubmission(attemptId: string, isAuto: boolean) {
    await withTransaction(async (client: any) => {
        // Mark attempt as submitted
        await client.query(
            `UPDATE exam_attempts SET
          status = $1,
          submitted_at = NOW(),
          auto_submitted = $2
          WHERE id = $3`,
            [isAuto ? "auto_submitted" : "submitted", isAuto, attemptId]
        );

        // Auto-mark MCQ, multi_choice, true_false
        const autoMarkRes = await client.query(
            `SELECT sa.id, sa.selected_option_ids, sa.answer_text, q.id as question_id,
                q.type, q.correct_answer, q.marks
         FROM student_answers sa
         JOIN exam_attempt_questions eqa ON eqa.id = sa.attempt_question_id
         JOIN questions q ON q.id = eqa.question_id
         WHERE sa.attempt_id = $1`,
            [attemptId]
        );

        let totalObtained = 0;
        let totalPossible = 0;

        // selected_option_ids / correct_answer may come back from Postgres as
        // JSON strings (or already-parsed arrays depending on the column type).
        // Normalise both to arrays before comparing.
        const toIdArray = (v: any): string[] => {
            if (!v) return [];
            if (Array.isArray(v)) return v.map((x: any) => String(x));
            if (typeof v === "string") {
                try {
                    const parsed = JSON.parse(v);
                    return Array.isArray(parsed)
                        ? parsed.map((x: any) => String(x))
                        : [String(parsed)];
                } catch {
                    return v ? [v] : [];
                }
            }
            return [String(v)];
        };

        for (const answerRow of autoMarkRes.rows as any[]) {
            const isObjective = ["mcq", "multi_choice", "true_false"].includes(answerRow.type);
            totalPossible += answerRow.marks;

            if (isObjective && answerRow.correct_answer) {
                const selectedIds = toIdArray(answerRow.selected_option_ids);
                const correctIds = toIdArray(answerRow.correct_answer);
                let isCorrect = false;

                if (answerRow.type === "mcq" || answerRow.type === "true_false") {
                    isCorrect = selectedIds.some((optId) => correctIds.includes(optId));
                } else {
                    // multi_choice — exact set match required
                    const selectedSet = new Set(selectedIds);
                    const correctSet = new Set(correctIds);
                    isCorrect =
                        selectedSet.size === correctSet.size &&
                        [...selectedSet].every((id) => correctSet.has(id));
                }

                if (isCorrect) {
                    totalObtained += answerRow.marks;
                }

                await client.query(
                    `UPDATE student_answers SET is_correct = $1, auto_marked = TRUE, marks_awarded = $2 WHERE id = $3`,
                    [isCorrect, isCorrect ? answerRow.marks : 0, answerRow.id]
                );
            }
            // Subjective / fill-in-the-blank questions are left for manual marking
        }

        const percentage = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 10000) / 100 : 0;

        const examRes = await client.query(
            `SELECT e.passing_marks FROM exams e JOIN exam_attempts ea ON ea.exam_id = e.id WHERE ea.id = $1`,
            [attemptId]
        );
        const passed = totalObtained >= examRes.rows[0].passing_marks;

        await client.query(
            `UPDATE exam_attempts SET
          total_obtained_marks = $1,
          total_possible_marks = $2,
          percentage = $3,
          passed = $4,
          status = CASE
            WHEN status = 'auto_submitted' THEN 'submitted'
            ELSE status
          END
          WHERE id = $5`,
            [totalObtained, totalPossible, percentage, passed, attemptId]
        );

        // Upsert result
        const attemptRes = await client.query(
            "SELECT student_id, exam_id FROM exam_attempts WHERE id = $1",
            [attemptId]
        );
        const { student_id: attemptStudentId, exam_id: attemptExamId } = attemptRes.rows[0];

        const grade =
            percentage >= 90 ? "A" : percentage >= 80 ? "B" : percentage >= 70 ? "C" : percentage >= 60 ? "D" : "F";

        await client.query(
            `INSERT INTO results (attempt_id, student_id, exam_id, total_marks, obtained_marks, percentage, grade, passed)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (attempt_id) DO UPDATE SET
            total_marks = EXCLUDED.total_marks,
            obtained_marks = EXCLUDED.obtained_marks,
            percentage = EXCLUDED.percentage,
            grade = EXCLUDED.grade,
            passed = EXCLUDED.passed`,
            [attemptId, attemptStudentId, attemptExamId, totalPossible, totalObtained, percentage, grade, passed]
        );
    });
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function getAttemptDetails(attemptId: string, studentProfileId: string) {
    const [attemptRes, questionsRes, answersRes] = await Promise.all([
        query(
            `SELECT ea.*, e.title as exam_title, e.duration_minutes, e.total_marks, e.passing_marks,
              e.shuffle_options, e.require_fullscreen, e.restrict_copy, e.restrict_paste,
              e.max_violations, e.auto_submit_on_violations, e.instructions
       FROM exam_attempts ea
       JOIN exams e ON e.id = ea.exam_id
       WHERE ea.id = $1`,
            [attemptId]
        ),
        query(
            `SELECT eqa.id as attempt_question_id, eqa.position,
              q.id as question_id, q.text, q.type, q.marks, q.category, q.difficulty,
              qo.id as option_id, qo.label, qo.text as option_text, qo.is_correct
       FROM exam_attempt_questions eqa
       JOIN questions q ON q.id = eqa.question_id
       LEFT JOIN question_options qo ON qo.question_id = q.id
       WHERE eqa.attempt_id = $1
       ORDER BY eqa.position, qo.sort_order`,
            [attemptId]
        ),
        query(
            `SELECT sa.id, sa.attempt_question_id, sa.answer_text, sa.selected_option_ids,
              sa.last_saved_at, sa.marks_awarded, sa.feedback, sa.is_correct
       FROM student_answers sa
       WHERE sa.attempt_id = $1`,
            [attemptId]
        ),
    ]);

    const attempt = attemptRes.rows[0];
    if (!attempt) throw new ApiError(404, "Attempt not found");

    // Group questions with their options
    const questionMap = new Map<string, any>();
    for (const row of questionsRes.rows) {
        const key = row.attempt_question_id;
        if (!questionMap.has(key)) {
            questionMap.set(key, {
                attemptQuestionId: row.attempt_question_id,
                questionId: row.question_id,
                text: row.text,
                type: row.type,
                marks: row.marks,
                category: row.category,
                difficulty: row.difficulty,
                position: row.position,
                options: [],
            });
        }
        if (row.option_id) {
            questionMap.get(key).options.push({
                id: row.option_id,
                label: row.label,
                text: row.option_text,
            });
        }
    }

    // Attach answers
    const answerMap = new Map<string, any>();
    for (const ans of answersRes.rows) {
        answerMap.set(ans.attempt_question_id, ans);
    }

    const questions = [...questionMap.values()].map((q: any) => {
        const answer = answerMap.get(q.attemptQuestionId);
        return {
            ...q,
            answer: {
                attemptQuestionId: q.attemptQuestionId,
                answerText: answer?.answer_text || null,
                selectedOptionIds: answer?.selected_option_ids || null,
                lastSavedAt: answer?.last_saved_at || null,
                marksAwarded: answer?.marks_awarded ?? null,
                feedback: answer?.feedback || null,
                isCorrect: answer?.is_correct ?? null,
            },
        };
    });

    // Shuffle options if configured
    if (attempt.shuffle_options) {
        for (const q of questions) {
            if (q.options.length > 1) {
                q.options = shuffleArray(q.options);
            }
        }
    }

    // Never expose correct answers to students
    for (const q of questions) {
        for (const opt of q.options) {
            delete opt.isCorrect;
        }
    }

    return {
        ...attempt,
        questions,
        violationCount: attempt.violation_count,
    };
}

export default router;
