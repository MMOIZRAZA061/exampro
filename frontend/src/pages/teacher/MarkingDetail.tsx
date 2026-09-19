import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Save,
    Wand2,
    ChevronLeft,
    ChevronRight,
    Lock,
    RotateCcw,
    Award,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { LoadingSpinner, useToast, formatDateTime } from "../../components/ui";
import { teacher } from "../../services/api";

type MarkDraft = {
    marksAwarded: number | null;
    feedback: string;
};

export default function TeacherMarkingDetail() {
    const { attemptId } = useParams<{ attemptId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [selected, setSelected] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, MarkDraft>>({});
    const [activeIdx, setActiveIdx] = useState(0);

    const load = async () => {
        if (!attemptId) return;
        setLoading(true);
        try {
            const res = await teacher.getAttempt(attemptId);
            const data = res.data;
            const next: Record<string, MarkDraft> = {};
            for (const a of data.answers || []) {
                next[a.answer_id] = {
                    marksAwarded: a.marks_awarded == null ? null : Number(a.marks_awarded),
                    feedback: a.feedback || "",
                };
            }
            setDrafts(next);
            setSelected(data);
            setActiveIdx(0);
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to load attempt", "error");
            navigate("/teacher/marking");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attemptId]);

    const isReadOnly = selected?.status === "completed";
    const answers = selected?.answers || [];
    const current = answers[activeIdx];

    const getDraft = (a: any): MarkDraft =>
        drafts[a.answer_id] || {
            marksAwarded: a.marks_awarded == null ? null : Number(a.marks_awarded),
            feedback: a.feedback || "",
        };

    const setDraft = (a: any, patch: Partial<MarkDraft>) => {
        setDrafts((prev) => ({
            ...prev,
            [a.answer_id]: { ...getDraft(a), ...patch },
        }));
    };

    const scoring = useMemo(() => {
        let totalObtained = 0;
        let totalPossible = 0;
        let markedCount = 0;
        for (const a of answers) {
            const max = Number(a.max_marks ?? a.marks ?? 0) || 0;
            totalPossible += max;
            const d = drafts[a.answer_id];
            const awarded = d?.marksAwarded == null ? 0 : Number(d.marksAwarded);
            totalObtained += awarded;
            if (d?.marksAwarded != null) markedCount += 1;
        }
        const percentage =
            totalPossible > 0
                ? Math.round((totalObtained / totalPossible) * 10000) / 100
                : 0;
        return {
            totalObtained,
            totalPossible,
            percentage,
            markedCount,
            total: answers.length,
        };
    }, [answers, drafts]);

    const toIdArray = (v: any): any[] => {
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

    const quickAward = (a: any, fraction: number) => {
        const max = Number(a.max_marks ?? a.marks ?? 0) || 0;
        setDraft(a, { marksAwarded: Math.round(max * fraction * 100) / 100 });
    };

    const clamp = (n: number, min: number, max: number) =>
        Math.max(min, Math.min(max, n));

    const handleSaveOne = async () => {
        if (!selected || !current || isReadOnly) return;
        setSubmitting(true);
        const d = getDraft(current);
        try {
            await teacher.markAnswer(selected.id, {
                answerId: current.answer_id,
                marksAwarded: d.marksAwarded == null ? 0 : Number(d.marksAwarded),
                feedback: d.feedback || "",
            });
            showToast("Mark saved", "success");
            await load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to save mark", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveAll = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            for (const a of selected.answers) {
                const d = getDraft(a);
                await teacher.markAnswer(selected.id, {
                    answerId: a.answer_id,
                    marksAwarded: d.marksAwarded == null ? 0 : Number(d.marksAwarded),
                    feedback: d.feedback || "",
                });
            }
            showToast("All marks saved", "success");
            await load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to save all marks", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalize = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            for (const a of selected.answers) {
                const d = getDraft(a);
                await teacher.markAnswer(selected.id, {
                    answerId: a.answer_id,
                    marksAwarded: d.marksAwarded == null ? 0 : Number(d.marksAwarded),
                    feedback: d.feedback || "",
                });
            }
            await teacher.finalizeMarking(selected.id);
            showToast("Marking finalized. Result published for grading.", "success");
            navigate("/teacher/marking");
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to finalize", "error");
            setSubmitting(false);
        }
    };

    const autoFillObjective = () => {
        if (!selected) return;
        setDrafts((prev) => {
            const next = { ...prev };
            for (const a of selected.answers) {
                const isOption =
                    a.type === "mcq" ||
                    a.type === "multi_choice" ||
                    a.type === "true_false";
                if (!isOption) continue;
                const max = Number(a.max_marks ?? a.marks ?? 0) || 0;
                next[a.answer_id] = {
                    marksAwarded: a.is_correct ? max : 0,
                    feedback: next[a.answer_id]?.feedback ?? "",
                };
            }
            return next;
        });
    };

    const awardFullAll = () => {
        if (!selected) return;
        setDrafts((prev) => {
            const next = { ...prev };
            for (const a of selected.answers) {
                const max = Number(a.max_marks ?? a.marks ?? 0) || 0;
                next[a.answer_id] = {
                    marksAwarded: max,
                    feedback: next[a.answer_id]?.feedback ?? "",
                };
            }
            return next;
        });
    };

    const awardNoneAll = () => {
        if (!selected) return;
        setDrafts((prev) => {
            const next = { ...prev };
            for (const a of selected.answers) {
                next[a.answer_id] = {
                    marksAwarded: 0,
                    feedback: next[a.answer_id]?.feedback ?? "",
                };
            }
            return next;
        });
    };

    // Keyboard shortcuts: arrow keys to navigate, S to save current, F to finalize
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
            if (e.key === "ArrowLeft" && activeIdx > 0) setActiveIdx(activeIdx - 1);
            else if (e.key === "ArrowRight" && activeIdx < answers.length - 1)
                setActiveIdx(activeIdx + 1);
            else if (e.key.toLowerCase() === "s" && current) {
                e.preventDefault();
                handleSaveOne();
            } else if (e.key.toLowerCase() === "f" && !isReadOnly && current) {
                e.preventDefault();
                handleFinalize();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIdx, answers.length, current, isReadOnly, selected]);

    if (loading || !selected) {
        return (
            <DashboardLayout activeSection="Marking">
                <LoadingSpinner text="Loading attempt..." />
            </DashboardLayout>
        );
    }

    const d = current ? getDraft(current) : null;
    const max = current ? Number(current.max_marks ?? current.marks ?? 0) || 0 : 0;
    const isOptionType =
        current?.type === "mcq" ||
        current?.type === "multi_choice" ||
        current?.type === "true_false";
    const selectedIds = current ? toIdArray(current.selected_option_ids) : [];
    const selectedOptions = current
        ? (current.options || []).filter((o: any) => selectedIds.includes(o.id))
        : [];
    const correctAnswer = current?.correct_answer
        ? toIdArray(current.correct_answer)
        : null;

    return (
        <DashboardLayout activeSection="Marking">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link
                        to="/teacher/marking"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                        title="Back to Marking"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {selected.student_name || "Unknown"}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {selected.exam_title} · Started{" "}
                            {formatDateTime(selected.started_at)}
                        </p>
                    </div>
                </div>
                {!isReadOnly && (
                    <button
                        onClick={handleFinalize}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Lock size={14} />
                        {submitting ? "Saving..." : "Finalize & Publish"}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                {/* Left: question palette + scoring */}
                <div className="space-y-4">
                    {/* Scoring */}
                    <div className="card p-4">
                        <div className="flex items-end justify-between mb-2">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Score (live)
                                </p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {scoring.totalObtained}
                                    <span className="text-base font-medium text-gray-500">
                                        {" "}
                                        / {scoring.totalPossible}
                                    </span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Progress
                                </p>
                                <p className="text-sm font-medium text-gray-700">
                                    {scoring.markedCount}/{scoring.total} ·{" "}
                                    {scoring.percentage}%
                                </p>
                            </div>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all"
                                style={{
                                    width: `${scoring.totalPossible > 0
                                        ? (scoring.totalObtained /
                                            scoring.totalPossible) *
                                        100
                                        : 0
                                        }%`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Quick tools */}
                    {!isReadOnly && (
                        <div className="card p-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Quick tools
                            </p>
                            <button
                                onClick={autoFillObjective}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded border border-gray-300 hover:bg-gray-100 text-sm"
                            >
                                <Wand2 size={14} /> Auto-mark objective
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={awardFullAll}
                                    className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100 text-sm"
                                >
                                    Full all
                                </button>
                                <button
                                    onClick={awardNoneAll}
                                    className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100 text-sm"
                                >
                                    Zero all
                                </button>
                            </div>
                            <button
                                onClick={handleSaveAll}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
                            >
                                <Save size={14} /> Save all marks
                            </button>
                        </div>
                    )}

                    {/* Question palette */}
                    <div className="card !p-0 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Questions ({answers.length})
                        </div>
                        <div className="p-3 grid grid-cols-4 gap-1.5">
                            {answers.map((a: any, i: number) => {
                                const dd = drafts[a.answer_id];
                                const marked = dd?.marksAwarded != null;
                                const state =
                                    a.is_correct === null
                                        ? marked
                                            ? "marked"
                                            : "pending"
                                        : a.is_correct
                                            ? "correct"
                                            : "wrong";
                                return (
                                    <button
                                        key={a.answer_id}
                                        onClick={() => setActiveIdx(i)}
                                        title={`Q${i + 1} · ${a.type}`}
                                        className={`w-full h-9 rounded text-xs font-medium transition-all flex items-center justify-center ${i === activeIdx
                                            ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                                            : state === "correct"
                                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                                : state === "wrong"
                                                    ? "bg-red-100 text-red-800 hover:bg-red-200"
                                                    : state === "marked"
                                                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: question detail */}
                <div className="card !p-0 overflow-hidden flex-1">
                    {/* Question nav */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                        <button
                            onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                            disabled={activeIdx === 0}
                            className="flex items-center gap-1 px-3 py-1 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-40"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <div className="text-xs text-gray-500">
                            Question {activeIdx + 1} of {answers.length}
                        </div>
                        <button
                            onClick={() =>
                                setActiveIdx((i) => Math.min(answers.length - 1, i + 1))
                            }
                            disabled={activeIdx === answers.length - 1}
                            className="flex items-center gap-1 px-3 py-1 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-40"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>

                    {current && d ? (
                        <div className="p-5 space-y-4">
                            {/* Question header + status */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 mb-1">
                                        {current.type.replace("_", " ").toUpperCase()} ·{" "}
                                        {max} marks
                                    </p>
                                    <p className="text-base text-gray-900 leading-relaxed">
                                        {current.question_text}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    {current.is_correct === null ? (
                                        <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200">
                                            <MinusCircle size={12} /> Needs grading
                                        </span>
                                    ) : current.is_correct ? (
                                        <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle2 size={12} /> Correct
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 bg-red-50 text-red-700 border border-red-200">
                                            <XCircle size={12} /> Incorrect
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 bg-gray-100 text-gray-700 border border-gray-200">
                                        <Award size={12} />{" "}
                                        {d.marksAwarded == null ? "—" : d.marksAwarded} /{" "}
                                        {max}
                                    </span>
                                </div>
                            </div>

                            {/* Student answer */}
                            <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                    Student's Answer
                                </p>
                                {isOptionType ? (
                                    selectedOptions.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {selectedOptions.map((o: any) => (
                                                <div
                                                    key={o.id}
                                                    className="text-sm rounded-lg px-3 py-2 bg-blue-50 text-blue-900 border border-blue-100"
                                                >
                                                    <span className="font-bold">
                                                        {o.label}.
                                                    </span>{" "}
                                                    {o.text}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">
                                            No option selected
                                        </p>
                                    )
                                ) : (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-950 whitespace-pre-wrap leading-relaxed">
                                        {current.answer_text?.trim() ? (
                                            current.answer_text
                                        ) : (
                                            <span className="italic text-blue-400">
                                                No answer provided
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Options for option types */}
                            {isOptionType && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                        All Options
                                    </p>
                                    <div className="space-y-1.5">
                                        {(current.options || []).map((o: any) => {
                                            const isSel = selectedIds.includes(o.id);
                                            return (
                                                <div
                                                    key={o.id}
                                                    className={`text-sm rounded-lg px-3 py-2 flex items-center gap-2 border ${o.is_correct
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                                        : isSel
                                                            ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                                                            : "bg-gray-50 border-gray-200 text-gray-700"
                                                        }`}
                                                >
                                                    <span className="font-bold">
                                                        {o.label}.
                                                    </span>
                                                    <span className="flex-1">
                                                        {o.text}
                                                    </span>
                                                    {o.is_correct && (
                                                        <span className="text-xs text-emerald-600 font-semibold">
                                                            ✓ correct
                                                        </span>
                                                    )}
                                                    {isSel && !o.is_correct && (
                                                        <span className="text-xs text-indigo-600 font-semibold">
                                                            student pick
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Correct answer for text types */}
                            {!isOptionType &&
                                correctAnswer &&
                                correctAnswer.length > 0 && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900">
                                        <span className="font-semibold">Correct:</span>{" "}
                                        {correctAnswer.join(", ")}
                                    </div>
                                )}

                            {/* Award controls */}
                            {!isReadOnly && (
                                <div className="border-t pt-4 space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                            Award Marks
                                        </p>
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <button
                                                onClick={() => quickAward(current, 1)}
                                                className="px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm"
                                            >
                                                Full ({max})
                                            </button>
                                            <button
                                                onClick={() => quickAward(current, 0.5)}
                                                className="px-3 py-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm"
                                            >
                                                Half
                                            </button>
                                            <button
                                                onClick={() => quickAward(current, 0)}
                                                className="px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 text-sm"
                                            >
                                                Zero
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setDraft(current, {
                                                        marksAwarded: null,
                                                    })
                                                }
                                                className="px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm"
                                            >
                                                <RotateCcw size={12} className="inline mr-1" />
                                                Reset
                                            </button>

                                            <div className="ml-auto flex items-center gap-2">
                                                <label className="text-sm text-gray-600">
                                                    Awarded:
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={max || undefined}
                                                    step={0.5}
                                                    value={
                                                        d.marksAwarded == null
                                                            ? ""
                                                            : d.marksAwarded
                                                    }
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        const parsed =
                                                            raw === ""
                                                                ? null
                                                                : clamp(
                                                                    Number(raw),
                                                                    0,
                                                                    max
                                                                );
                                                        setDraft(current, {
                                                            marksAwarded: parsed,
                                                        });
                                                    }}
                                                    className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                                                />
                                                <span className="text-sm text-gray-500">
                                                    / {max}
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={max || 0}
                                            step={0.5}
                                            value={d.marksAwarded ?? 0}
                                            onChange={(e) =>
                                                setDraft(current, {
                                                    marksAwarded: Number(
                                                        e.target.value
                                                    ),
                                                })
                                            }
                                            className="w-full accent-indigo-600"
                                        />
                                    </div>

                                    {/* Feedback */}
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                            Feedback
                                        </p>
                                        <textarea
                                            rows={2}
                                            placeholder="Optional feedback for the student..."
                                            value={d.feedback}
                                            onChange={(e) =>
                                                setDraft(current, {
                                                    feedback: e.target.value,
                                                })
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleSaveOne}
                                            disabled={submitting}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            <Save size={14} />
                                            {submitting ? "Saving..." : "Save this mark"}
                                        </button>
                                        <button
                                            onClick={handleSaveAll}
                                            disabled={submitting}
                                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Save all
                                        </button>
                                        <span className="ml-auto text-xs text-gray-500">
                                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                                S
                                            </kbd>{" "}
                                            save ·{" "}
                                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                                ←/→
                                            </kbd>{" "}
                                            nav ·{" "}
                                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                                F
                                            </kbd>{" "}
                                            finalize
                                        </span>
                                    </div>
                                </div>
                            )}

                            {isReadOnly && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-gray-500">
                                        This attempt has been finalized. Marks are
                                        read-only.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            No answers available for this attempt.
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
