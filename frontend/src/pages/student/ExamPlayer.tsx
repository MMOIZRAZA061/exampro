import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { exam } from "../../services/api";
import { useToast, LoadingSpinner } from "../../components/ui";

interface QuestionData {
    attemptQuestionId: string;
    questionId: string;
    text: string;
    type: string;
    marks: number;
    options: { id: string; label: string; text: string }[];
    answer: {
        attemptQuestionId: string;
        answerText: string | null;
        selectedOptionIds: string[] | null;
        lastSavedAt: string | null;
    };
}

interface AttemptData {
    id: string;
    exam_id: string;
    status: string;
    deadline_at: string;
    instructions?: string;
    violation_count?: number;
    shuffle_options?: boolean;
    require_fullscreen?: boolean;
    restrict_copy?: boolean;
    restrict_paste?: boolean;
    max_violations?: number;
    auto_submit_on_violations?: boolean;
    questions: QuestionData[];
}

export default function ExamPlayer() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [attempt, setAttempt] = useState<AttemptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [activeQIndex, setActiveQIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [violations, setViolations] = useState(0);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [submitReason, setSubmitReason] = useState<
        "manual" | "auto" | "violations"
    >("manual");

    const answersRef = useRef(answers);
    answersRef.current = answers;
    const examIdRef = useRef(examId);
    examIdRef.current = examId;
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastUserAction = useRef(Date.now());
    const cleanupRef = useRef<(() => void) | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const deadlineRef = useRef<number>(0);

    const startTimer = useCallback(() => {
        const tick = () => {
            if (!deadlineRef.current) return;
            const remaining = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                submitExam("auto");
            }
        };
        tick();
        timerRef.current = setInterval(tick, 1000);
    }, []);

    const submitExam = async (reason: "manual" | "auto" | "violations") => {
        if (submitting || submittedRef.current) return;
        setSubmitting(true);
        try {
            // Flush any pending debounced autosave immediately so the final
            // answer state is persisted before the attempt is closed.
            if (autoSaveTimer.current) {
                clearTimeout(autoSaveTimer.current);
                autoSaveTimer.current = null;
            }
            const pendingQuestion = attempt?.questions[activeQIndex];
            if (pendingQuestion) await saveAnswer(pendingQuestion).catch(() => { });
            await exam.submit(examId!, { attemptId: attempt!.id, reason });
            submittedRef.current = true;
            setSubmitReason(reason);
            setSubmitted(true);
            if (timerRef.current) clearInterval(timerRef.current);
        } catch (e: any) {
            // Surface the error but keep the exam usable — the submit button
            // must remain available so the student can retry / submit manually.
            showToast(e.response?.data?.message || "Failed to submit", "error");
            setSubmitting(false);
        }
    };

    const submittedRef = useRef(false);

    const reportViolation = async (
        eventType: string,
        description?: string
    ) => {
        // Stop reporting once the exam has been submitted (or is being
        // submitted). The backend returns 404 for security events on any
        // attempt that is no longer in_progress, so we never want to
        // fire them after the exam is over.
        if (submittedRef.current) return;
        try {
            const res = await exam.reportSecurityEvent(examId!, {
                eventType,
                description,
            });
            setViolations(res.data.violationCount);
            if (res.data.shouldAutoSubmit) {
                submitExam("violations");
            }
        } catch (e: any) {
            // 404 means the attempt is no longer in progress (e.g. it was
            // just auto-submitted or manually submitted, or the exam was
            // already finished before the player loaded). Stop reporting
            // and surface the "result submitted" screen.
            if (e.response?.status === 404 && !submittedRef.current) {
                submittedRef.current = true;
                setSubmitReason("violations");
                setSubmitted(true);
                if (timerRef.current) clearInterval(timerRef.current);
                showToast("Exam is no longer in progress", "info");
            }
            // other network errors: ignore
        }
    };

    const saveAnswer = async (q: QuestionData) => {
        const data = answersRef.current[q.attemptQuestionId];
        if (!data) return;
        try {
            const payload: any = {
                attemptQuestionId: q.attemptQuestionId,
            };
            if (data.answerText !== undefined)
                payload.answerText = data.answerText;
            if (data.selectedOptionIds !== undefined)
                payload.selectedOptionIds = data.selectedOptionIds;
            await exam.saveAnswer(examId!, payload);
            setLastSaved(new Date().toISOString());
        } catch {
            // silent fail on autosave
        }
    };

    const setAnswer = useCallback(
        (q: QuestionData, update: any) => {
            setAnswers((prev: any) => ({
                ...prev,
                [q.attemptQuestionId]: {
                    answerText: update.answerText,
                    selectedOptionIds: update.selectedOptionIds,
                },
            }));
            // debounce autosave
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(() => saveAnswer(q), 2000);
            lastUserAction.current = Date.now();
        },
        [examId]
    );

    const initialize = async () => {
        if (!examId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await exam.start(examId);
            const data = res.data;
            setAttempt(data);
            if (data.deadline_at) {
                deadlineRef.current = new Date(data.deadline_at).getTime();
            }
            setLoading(false);
            // build initial answers map
            const map: Record<string, any> = {};
            for (const q of data.questions || []) {
                map[q.attemptQuestionId] = {
                    answerText: q.answer?.answerText ?? undefined,
                    selectedOptionIds: q.answer?.selectedOptionIds ?? undefined,
                };
            }
            setAnswers(map);
            setViolations(data.violation_count || 0);
            setActiveQIndex(0);

            // start timer
            startTimer();

            // security listeners
            const onVisibility = () => {
                if (document.hidden) {
                    reportViolation(
                        "visibility_changed",
                        "Page was hidden"
                    );
                }
            };
            const onBlur = () => {
                if (Date.now() - lastUserAction.current > 5000) {
                    reportViolation("focus_lost", "Window lost focus");
                }
            };
            const onCopy = (e: ClipboardEvent) => {
                e.preventDefault();
                reportViolation("copy_attempt", "Copy attempted");
            };
            const onPaste = (e: ClipboardEvent) => {
                e.preventDefault();
                reportViolation("paste_attempt", "Paste attempted");
            };
            const onKeydown = (e: KeyboardEvent) => {
                if (e.key === "Tab") {
                    e.preventDefault();
                    reportViolation("tab_switched", "Tab key used");
                }
            };

            document.addEventListener("visibilitychange", onVisibility);
            window.addEventListener("blur", onBlur);
            document.addEventListener("copy", onCopy);
            document.addEventListener("paste", onPaste);
            document.addEventListener("keydown", onKeydown);

            // fullscreen
            if (data.require_fullscreen && !document.fullscreenElement) {
                try {
                    await document.documentElement.requestFullscreen();
                } catch {
                    // user may have denied
                }
            }

            // cleanup function stored for useEffect
            cleanupRef.current = () => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                if (autoSaveTimer.current)
                    clearTimeout(autoSaveTimer.current);
                document.removeEventListener("visibilitychange", onVisibility);
                window.removeEventListener("blur", onBlur);
                document.removeEventListener("copy", onCopy);
                document.removeEventListener("paste", onPaste);
                document.removeEventListener("keydown", onKeydown);
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
            };
        } catch (e: any) {
            const msg =
                e.response?.data?.message ||
                e.response?.data?.error ||
                "Failed to start exam";
            setLoading(false);
            // Handle race-condition 409 ("Resource already exists" from the
            // unique exam_attempts(exam_id, student_id) constraint) and any
            // explicit "already submitted/completed" message as a graceful
            // redirect instead of a hard error screen.
            const status = e.response?.status;
            const alreadyDone =
                status === 409 ||
                (status === 400 &&
                    (msg.toLowerCase().includes("already submitted") ||
                        msg.toLowerCase().includes("already completed") ||
                        msg.toLowerCase().includes("no longer in progress")));
            if (alreadyDone) {
                showToast("You have already completed this exam", "info");
                navigate("/student/exams", { replace: true });
            } else {
                setError(msg);
            }
        }
    };

    useEffect(() => {
        initialize();
        return () => {
            cleanupRef.current?.();
            cleanupRef.current = null;
        };
    }, []);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, "0")}:${s
            .toString()
            .padStart(2, "0")}`;
    };

    const isLow = timeLeft < 300;

    if (loading)
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <LoadingSpinner text="Starting exam..." />
            </div>
        );

    if (error)
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-6">
                <div className="text-center">
                    <p className="text-2xl font-bold mb-2">
                        Exam could not be started
                    </p>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={() => navigate("/student/exams")}
                        className="px-4 py-2 bg-indigo-600 rounded-lg text-sm"
                    >
                        Back to Exams
                    </button>
                </div>
            </div>
        );

    if (!attempt) return null;

    // ── "Result submitted" confirmation screen ────────────────────────
    // Shown for every submission path: manual, time-out (auto) and
    // violation-limit auto-submit. It replaces the silent redirect so the
    // student clearly sees the outcome before being sent to the exams /
    // results pages.
    if (submitted) {
        const isAuto = submitReason === "auto" || submitReason === "violations";
        const heading =
            submitReason === "violations"
                ? "Exam auto-submitted"
                : submitReason === "auto"
                    ? "Time expired — exam submitted"
                    : "Exam submitted";
        const subtitle =
            submitReason === "violations"
                ? "The maximum number of violations was reached, so your answers were locked and submitted automatically."
                : submitReason === "auto"
                    ? "The timer ran out, so your exam was submitted automatically with whatever you had answered."
                    : "Your answers have been locked. Awaiting marking and publication of your result.";
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center shadow-2xl">
                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isAuto ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-8 h-8"
                        >
                            {isAuto ? (
                                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            ) : (
                                <path d="M20 6L9 17l-5-5" />
                            )}
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{heading}</h2>
                    <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                        {subtitle}
                    </p>
                    <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 mb-6 text-sm">
                        <div className="flex items-center justify-between py-1">
                            <span className="text-gray-400">Status</span>
                            <span className="text-gray-200 font-medium">
                                Submitted · awaiting marks
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                            <span className="text-gray-400">Questions</span>
                            <span className="text-gray-200 font-medium">
                                {attempt.questions.length}
                            </span>
                        </div>
                        {attempt.max_violations != null && (
                            <div className="flex items-center justify-between py-1">
                                <span className="text-gray-400">Violations</span>
                                <span className="text-amber-400 font-medium">
                                    {violations}/{attempt.max_violations}
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => navigate("/student/results", { replace: true })}
                        className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                    >
                        View Results
                    </button>
                    <button
                        onClick={() => navigate("/student/exams", { replace: true })}
                        className="w-full mt-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                    >
                        Back to Exams
                    </button>
                </div>
            </div>
        );
    }

    const q = attempt.questions[activeQIndex];
    const currentAnswer = answers[q.attemptQuestionId] || {};
    const answeredCount = attempt.questions.filter((qq) =>
        answers[qq.attemptQuestionId]?.answerText ||
        answers[qq.attemptQuestionId]?.selectedOptionIds?.length
    ).length;

    const hasOptions = q.type === "mcq" || q.type === "multi_choice" || q.type === "true_false";
    const isMulti = q.type === "multi_choice";

    const toggleOption = (optId: string) => {
        if (!isMulti) {
            setAnswer(q, {
                selectedOptionIds: [optId],
                answerText: undefined,
            });
        } else {
            const current: string[] =
                currentAnswer.selectedOptionIds || [];
            const updated = current.includes(optId)
                ? current.filter((x) => x !== optId)
                : [...current, optId];
            setAnswer(q, {
                selectedOptionIds: updated,
                answerText: undefined,
            });
        }
    };

    const setTextAnswer = (text: string) => {
        setAnswer(q, {
            answerText: text,
            selectedOptionIds: undefined,
        });
    };

    return (
        <div
            className="min-h-screen bg-gray-900 text-white flex flex-col"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Top bar */}
            <div
                className={`sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b ${isLow
                    ? "bg-red-900/60 border-red-700"
                    : "bg-gray-800 border-gray-700"
                    }`}
            >
                <div className="text-sm text-gray-300">
                    <span className="font-semibold text-white">
                        {activeQIndex + 1}/{attempt.questions.length}
                    </span>{" "}
                    · {answeredCount} answered
                </div>
                <div
                    className={`font-mono text-xl font-bold ${isLow ? "text-red-300" : "text-emerald-400"
                        }`}
                >
                    {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-gray-400">
                    Violations:{" "}
                    <span
                        className={
                            violations > 0 ? "text-amber-400" : "text-gray-400"
                        }
                    >
                        {violations}
                        {attempt.max_violations
                            ? `/${attempt.max_violations}`
                            : ""}
                    </span>
                </div>
            </div>

            <div className="flex flex-1">
                {/* Question palette */}
                <aside className="w-20 lg:w-28 border-r border-gray-700 bg-gray-800/40 p-2 overflow-y-auto hidden sm:block">
                    <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5">
                        {attempt.questions.map((qq, i) => {
                            const answered =
                                answers[qq.attemptQuestionId]
                                    ?.answerText ||
                                answers[qq.attemptQuestionId]
                                    ?.selectedOptionIds?.length;
                            const isActive = i === activeQIndex;
                            return (
                                <button
                                    key={qq.attemptQuestionId}
                                    onClick={() => setActiveQIndex(i)}
                                    className={`w-8 h-8 lg:w-9 lg:h-9 rounded text-xs font-medium transition-colors ${isActive
                                        ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                                        : answered
                                            ? "bg-emerald-700 text-white"
                                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Main question area */}
                <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">
                                Question {activeQIndex + 1}
                            </h2>
                            <span className="text-xs text-gray-400">
                                {q.type.replace("_", " ").toUpperCase()} ·{" "}
                                {q.marks} marks
                            </span>
                        </div>

                        <p className="text-base mb-4 text-gray-100 leading-relaxed">
                            {q.text}
                        </p>

                        {hasOptions ? (
                            <div className="space-y-2">
                                {q.options.map((opt) => {
                                    const selected =
                                        currentAnswer.selectedOptionIds?.includes(
                                            opt.id
                                        );
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => toggleOption(opt.id)}
                                            className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${selected
                                                ? "border-indigo-500 bg-indigo-900/40 text-white"
                                                : "border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300"
                                                }`}
                                        >
                                            <span
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected
                                                    ? "bg-indigo-500 text-white"
                                                    : "bg-gray-600 text-gray-300"
                                                    }`}
                                            >
                                                {opt.label}
                                            </span>
                                            <span>{opt.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <textarea
                                value={currentAnswer.answerText || ""}
                                onChange={(e) => setTextAnswer(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={q.type === "long_answer" ? 8 : 3}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                            />
                        )}

                        <div className="mt-6 flex items-center justify-between">
                            <button
                                disabled={activeQIndex === 0}
                                onClick={() =>
                                    setActiveQIndex((i) => i - 1)
                                }
                                className="px-4 py-2 text-sm bg-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-600"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setShowSubmitModal(true)}
                                className="px-6 py-2 bg-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-700"
                            >
                                Submit Exam
                            </button>
                            <button
                                disabled={
                                    activeQIndex ===
                                    attempt.questions.length - 1
                                }
                                onClick={() =>
                                    setActiveQIndex((i) => i + 1)
                                }
                                className="px-4 py-2 text-sm bg-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-600"
                            >
                                Next
                            </button>
                        </div>

                        {lastSaved && (
                            <p className="mt-3 text-xs text-gray-500 text-center">
                                Auto-saved at {new Date(lastSaved).toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                </main>
            </div>

            {/* Submit confirmation modal */}
            {showSubmitModal && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    role="dialog"
                >
                    <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold mb-2">
                            Submit exam?
                        </h3>
                        <p className="text-sm text-gray-300 mb-4">
                            You have answered{" "}
                            <strong>{answeredCount}</strong> of{" "}
                            <strong>{attempt.questions.length}</strong> questions.
                            Unanswered questions will receive 0 marks. Once
                            submitted, you cannot go back.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowSubmitModal(false)}
                                className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
                            >
                                Keep Working
                            </button>
                            <button
                                onClick={() => {
                                    setShowSubmitModal(false);
                                    submitExam("manual");
                                }}
                                disabled={submitting}
                                className="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {submitting ? "Submitting..." : "Submit Now"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
