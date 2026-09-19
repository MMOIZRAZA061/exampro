import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { ListChecks, Plus, Trash2, Pencil, X } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    Modal,
    ConfirmDialog,
    useToast,
} from "../../components/ui";
import { teacher } from "../../services/api";

const QUESTION_TYPES: { value: string; label: string; hasOptions: boolean; optionsRequired: number }[] = [
    { value: "mcq", label: "Multiple Choice (MCQ)", hasOptions: true, optionsRequired: 4 },
    { value: "multi_choice", label: "Multiple Select", hasOptions: true, optionsRequired: 4 },
    { value: "true_false", label: "True / False", hasOptions: true, optionsRequired: 2 },
    { value: "short_answer", label: "Short Answer", hasOptions: false, optionsRequired: 0 },
    { value: "long_answer", label: "Long Answer", hasOptions: false, optionsRequired: 0 },
    { value: "fill_blank", label: "Fill in the Blank", hasOptions: false, optionsRequired: 0 },
];

const DIFFICULTIES = ["easy", "medium", "hard"];

export default function TeacherQuestions() {
    const [searchParams, setSearchParams] = useSearchParams();
    const bankFilter = searchParams.get("bankId") || "";

    const [banks, setBanks] = useState<any[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const emptyOptions = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            label: String.fromCharCode(65 + i),
            text: "",
            isCorrect: false,
        }));

    const [form, setForm] = useState<any>({
        bankId: bankFilter,
        text: "",
        type: "mcq",
        category: "",
        difficulty: "medium",
        marks: 1,
        correctAnswer: "",
        explanation: "",
        options: emptyOptions(4),
    });

    useEffect(() => {
        loadBanks();
    }, []);

    useEffect(() => {
        loadQuestions();
    }, [bankFilter]);

    const loadBanks = async () => {
        try {
            const res = await teacher.questionBanks();
            setBanks(res.data);
        } catch {
            /* ignore */
        }
    };

    const loadQuestions = async () => {
        setLoading(true);
        try {
            const res = await teacher.questions({
                bankId: bankFilter || undefined,
            });
            setQuestions(res.data);
        } catch {
            showToast("Failed to load questions", "error");
        } finally {
            setLoading(false);
        }
    };

    const typeMeta = QUESTION_TYPES.find((t) => t.value === form.type)!;

    const openNew = () => {
        setEditTarget(null);
        setForm({
            bankId: bankFilter || (banks[0]?.id ?? ""),
            text: "",
            type: "mcq",
            category: "",
            difficulty: "medium",
            marks: 1,
            correctAnswer: "",
            explanation: "",
            options: emptyOptions(4),
        });
        setShowForm(true);
    };

    const openEdit = async (q: any) => {
        try {
            const res = await teacher.getQuestion(q.id);
            const data = res.data;
            setEditTarget(q);
            setForm({
                bankId: data.question_bank_id,
                text: data.text,
                type: data.type,
                category: data.category || "",
                difficulty: data.difficulty,
                marks: data.marks,
                correctAnswer: data.correct_answer || "",
                explanation: data.explanation || "",
                options:
                    data.options?.length
                        ? data.options.map((o: any, i: number) => ({
                            label: o.label || String.fromCharCode(65 + i),
                            text: o.text,
                            isCorrect: !!o.is_correct,
                        }))
                        : emptyOptions(QUESTION_TYPES.find((t) => t.value === data.type)?.optionsRequired || 4),
            });
            setShowForm(true);
        } catch {
            showToast("Failed to load question", "error");
        }
    };

    const handleTypeChange = (value: string) => {
        const meta = QUESTION_TYPES.find((t) => t.value === value)!;
        setForm({
            ...form,
            type: value,
            options: meta.hasOptions ? emptyOptions(meta.optionsRequired) : [],
        });
    };

    const updateOption = (idx: number, field: string, value: any) => {
        const opts = [...form.options];
        opts[idx] = { ...opts[idx], [field]: value };
        setForm({ ...form, options: opts });
    };

    const handleSave = async () => {
        if (!form.bankId || !form.text) {
            showToast("Bank and question text are required", "error");
            return;
        }
        if (typeMeta.hasOptions) {
            const valid = form.options.filter((o: any) => o.text.trim());
            if (valid.length < 2) {
                showToast("At least two options are required", "error");
                return;
            }
        }
        setSubmitting(true);
        try {
            const payload: any = {
                bankId: form.bankId,
                text: form.text,
                type: form.type,
                category: form.category || undefined,
                difficulty: form.difficulty,
                marks: Number(form.marks),
                correctAnswer:
                    form.type === "true_false"
                        ? form.options.find((o: any) => o.isCorrect)?.text || "true"
                        : form.correctAnswer ||
                        (form.options.find((o: any) => o.isCorrect)?.text || undefined),
                explanation: form.explanation || undefined,
            };
            if (typeMeta.hasOptions) {
                payload.options = form.options.filter((o: any) => o.text.trim());
            }
            if (editTarget) {
                const { bankId, options, ...upd } = payload;
                await teacher.updateQuestion(editTarget.id, upd);
                showToast("Question updated");
            } else {
                await teacher.createQuestion(payload);
                showToast("Question created");
            }
            setShowForm(false);
            loadQuestions();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to save question", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSubmitting(true);
        try {
            await teacher.deleteQuestion(deleteTarget.id);
            showToast("Question deleted");
            setDeleteTarget(null);
            loadQuestions();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to delete question", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout activeSection="Questions">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Questions</h2>
                    <p className="text-sm text-gray-500">
                        {bankFilter
                            ? "Questions in selected bank"
                            : "All of your questions"}
                    </p>
                </div>
                <button onClick={openNew} className="btn-primary">
                    <Plus size={18} /> New Question
                </button>
            </div>

            {/* Bank filter */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                    className={`btn-secondary ${!bankFilter ? "!bg-blue-100" : ""} !px-3 !py-1.5 text-sm`}
                    onClick={() => {
                        searchParams.delete("bankId");
                        setSearchParams(searchParams);
                    }}
                >
                    All
                </button>
                {banks.map((b) => (
                    <button
                        key={b.id}
                        className={`btn-secondary ${bankFilter === b.id ? "!bg-blue-100" : ""} !px-3 !py-1.5 text-sm`}
                        onClick={() => {
                            searchParams.set("bankId", b.id);
                            setSearchParams(searchParams);
                        }}
                    >
                        {b.name}
                    </button>
                ))}
            </div>

            {loading ? (
                <LoadingSpinner text="Loading questions..." />
            ) : questions.length === 0 ? (
                <EmptyState
                    icon={<ListChecks size={40} />}
                    title="No questions"
                    description="Create your first question."
                />
            ) : (
                <div className="space-y-3">
                    {questions.map((q) => (
                        <div key={q.id} className="card !p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="badge badge-info">
                                            {QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type}
                                        </span>
                                        <span className="badge badge-warning capitalize">{q.difficulty}</span>
                                        <span className="badge badge-neutral">{q.marks} marks</span>
                                        {q.category && <span className="badge badge-neutral">{q.category}</span>}
                                    </div>
                                    <p className="text-gray-900 font-medium">{q.text}</p>
                                    <p className="text-xs text-gray-400 mt-1">{q.bank_name}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button className="btn-secondary text-xs !px-2 !py-1" onClick={() => openEdit(q)}>
                                        <Pencil size={14} />
                                    </button>
                                    <button className="btn-danger text-xs !px-2 !py-1" onClick={() => setDeleteTarget(q)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Question form */}
            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editTarget ? "Edit Question" : "New Question"}
            >
                <div className="space-y-3">
                    <div>
                        <label className="label">Question Bank *</label>
                        <select
                            className="input"
                            value={form.bankId}
                            onChange={(e) => setForm({ ...form, bankId: e.target.value })}
                            disabled={!!editTarget}
                        >
                            <option value="">Select a bank</option>
                            {banks.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Question Text *</label>
                        <textarea
                            className="input"
                            rows={2}
                            value={form.text}
                            onChange={(e) => setForm({ ...form, text: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Type</label>
                            <select className="input" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                                {QUESTION_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Difficulty</label>
                            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                                {DIFFICULTIES.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Category</label>
                            <input
                                className="input"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Marks</label>
                            <input
                                type="number"
                                min={1}
                                className="input"
                                value={form.marks}
                                onChange={(e) => setForm({ ...form, marks: e.target.value })}
                            />
                        </div>
                    </div>

                    {typeMeta.hasOptions && (
                        <div>
                            <label className="label">Options (check the correct one)</label>
                            <div className="space-y-2">
                                {form.options.map((o: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={o.isCorrect}
                                            onChange={(e) =>
                                                updateOption(i, "isCorrect", e.target.checked)
                                            }
                                        />
                                        <input
                                            className="input"
                                            value={o.text}
                                            placeholder={`Option ${o.label}`}
                                            onChange={(e) => updateOption(i, "text", e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="text-gray-400 hover:text-red-500"
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    options: form.options.filter((_o: any, idx: number) => idx !== i),
                                                })
                                            }
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="btn-secondary text-xs !px-3 !py-1.5"
                                    onClick={() =>
                                        setForm({
                                            ...form,
                                            options: [
                                                ...form.options,
                                                {
                                                    label: String.fromCharCode(
                                                        65 + form.options.length
                                                    ),
                                                    text: "",
                                                    isCorrect: false,
                                                },
                                            ],
                                        })
                                    }
                                >
                                    <Plus size={14} /> Add option
                                </button>
                            </div>
                        </div>
                    )}

                    {!typeMeta.hasOptions && form.type !== "true_false" && (
                        <div>
                            <label className="label">Correct Answer</label>
                            <input
                                className="input"
                                value={form.correctAnswer}
                                onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                            />
                        </div>
                    )}

                    <div>
                        <label className="label">Explanation</label>
                        <textarea
                            className="input"
                            rows={2}
                            value={form.explanation}
                            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button className="btn-secondary" onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={handleSave} disabled={submitting}>
                            {submitting ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete question"
                message={`Delete this question? ${deleteTarget?.text || ""}`}
                confirmText="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                loading={submitting}
            />
        </DashboardLayout>
    );
}
