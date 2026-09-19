import { Check, XCircle, MinusCircle, Quote } from "lucide-react";

interface OptionData {
    id: string;
    label: string;
    text: string;
    is_correct?: boolean;
}

interface BreakdownItem {
    answer_id: string;
    position?: number;
    question_text: string;
    type: string;
    marks?: number;
    answer_text?: string | null;
    selected_option_ids?: any;
    correct_answer?: any;
    options?: OptionData[];
    is_correct?: boolean | null;
    marks_awarded?: number | null;
    feedback?: string | null;
}

interface AnswerReviewProps {
    breakdown: BreakdownItem[];
    /** When true, show the correct option and teacher feedback (teacher view). */
    showTeacherInfo?: boolean;
}

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

const isOptionType = (type: string) =>
    type === "mcq" || type === "multi_choice" || type === "true_false";

function StatusPill({
    isCorrect,
    awarded,
    marks,
}: {
    isCorrect: boolean | null | undefined;
    awarded: number | null | undefined;
    marks: number;
}) {
    if (isCorrect === true)
        return (
            <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 font-medium">
                <Check size={12} /> Correct
            </span>
        );
    if (isCorrect === false)
        return (
            <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-red-50 text-red-700 font-medium">
                <XCircle size={12} /> Incorrect
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 font-medium">
            <MinusCircle size={12} />
            {awarded != null ? `${awarded}/${marks} awarded` : "Awaiting grading"}
        </span>
    );
}

export default function AnswerReview({
    breakdown,
    showTeacherInfo,
}: AnswerReviewProps) {
    if (!breakdown || breakdown.length === 0)
        return <p className="text-sm text-gray-400 italic">No answers recorded.</p>;

    return (
        <div className="space-y-3">
            {breakdown.map((b, i: number) => {
                const max = Number(b.marks ?? 0) || 0;
                const selectedIds = toIdArray(b.selected_option_ids);
                const correctAnswer = b.correct_answer
                    ? toIdArray(b.correct_answer)
                    : null;
                const opted = isOptionType(b.type);
                const chosen = (b.options || []).filter((o) =>
                    selectedIds.includes(o.id)
                );

                return (
                    <div
                        key={b.answer_id || i}
                        className={`rounded-xl border p-4 ${b.is_correct === true
                            ? "border-emerald-200 bg-emerald-50/30"
                            : b.is_correct === false
                                ? "border-red-200 bg-red-50/30"
                                : "border-gray-200"
                            }`}
                    >
                        {/* Question */}
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
                                {b.position ?? i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                    {b.question_text}
                                </p>
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                        {b.type.replace("_", " ")}
                                    </span>
                                    {max > 0 && (
                                        <span className="text-[11px] text-gray-400">
                                            · {max} mark{max === 1 ? "" : "s"}
                                        </span>
                                    )}
                                    <StatusPill
                                        isCorrect={b.is_correct}
                                        awarded={b.marks_awarded}
                                        marks={max}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Student answer */}
                        <div className="mt-3 pl-8">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                Your answer
                            </p>
                            {opted ? (
                                chosen.length > 0 ? (
                                    <div className="space-y-1">
                                        {chosen.map((o) => (
                                            <div
                                                key={o.id}
                                                className={`text-xs rounded-lg px-3 py-2 ${showTeacherInfo && o.is_correct
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : showTeacherInfo &&
                                                        b.is_correct === false
                                                        ? "bg-red-100 text-red-800"
                                                        : "bg-blue-50 text-blue-800"
                                                    }`}
                                            >
                                                <span className="font-bold">
                                                    {o.label}.
                                                </span>{" "}
                                                {o.text}
                                                {showTeacherInfo && o.is_correct && (
                                                    <span className="ml-2 text-emerald-600 font-semibold">
                                                        ✓ correct
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">
                                        No option selected
                                    </p>
                                )
                            ) : (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                                    {b.answer_text?.trim() ? (
                                        b.answer_text
                                    ) : (
                                        <span className="italic text-blue-400">
                                            No answer provided
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Correct options highlighted (teacher view) */}
                            {showTeacherInfo &&
                                opted &&
                                correctAnswer &&
                                correctAnswer.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">
                                            Correct option
                                        </p>
                                        <div className="space-y-1">
                                            {(b.options || [])
                                                .filter((o) =>
                                                    correctAnswer.includes(o.id)
                                                )
                                                .map((o) => (
                                                    <div
                                                        key={o.id}
                                                        className="text-xs rounded-lg px-3 py-2 bg-emerald-50 text-emerald-800"
                                                    >
                                                        <span className="font-bold">
                                                            {o.label}.
                                                        </span>{" "}
                                                        {o.text}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                            {/* Correct answer reference for text types */}
                            {showTeacherInfo &&
                                !opted &&
                                correctAnswer &&
                                correctAnswer.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">
                                            Model answer
                                        </p>
                                        <div className="bg-emerald-50 rounded-lg p-2 text-xs text-emerald-800">
                                            {correctAnswer.join(", ")}
                                        </div>
                                    </div>
                                )}

                            {/* Teacher feedback */}
                            {showTeacherInfo && b.feedback?.trim() && (
                                <div className="mt-2 flex items-start gap-2 bg-indigo-50 rounded-lg p-3">
                                    <Quote
                                        size={14}
                                        className="text-indigo-500 mt-0.5 flex-shrink-0"
                                    />
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 mb-0.5">
                                            Teacher's note
                                        </p>
                                        <p className="text-xs text-indigo-800 whitespace-pre-wrap">
                                            {b.feedback}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
