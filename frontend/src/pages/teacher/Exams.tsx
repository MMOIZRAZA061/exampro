import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BookOpen, Plus, Trash2, Pencil, Play, CheckCircle } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    Modal,
    ConfirmDialog,
    StatusBadge,
    useToast,
    formatDateTime,
} from "../../components/ui";
import { teacher } from "../../services/api";

const emptyForm: any = {
    title: "",
    subject: "",
    description: "",
    instructions: "",
    classId: "",
    questionBankId: "",
    durationMinutes: 60,
    totalMarks: 100,
    passingPercentage: 40,
    startAt: "",
    endAt: "",
    status: "draft",
    questionsPerStudent: 10,
    allowedCategories: [] as string[],
    allowedDifficulties: [] as string[],
    shuffleQuestions: true,
    shuffleOptions: true,
    requireFullscreen: false,
    restrictCopy: false,
    restrictPaste: false,
    maxViolations: 3,
    autoSubmitOnViolations: false,
};

export default function TeacherExams() {
    const [exams, setExams] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [banks, setBanks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [statusTarget, setStatusTarget] = useState<any | null>(null);
    const [nextStatus, setNextStatus] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const [form, setForm] = useState<any>(emptyForm);

    const load = async () => {
        setLoading(true);
        try {
            const [eRes, cRes, bRes] = await Promise.all([
                teacher.exams(),
                teacher.classes(),
                teacher.questionBanks(),
            ]);
            setExams(eRes.data);
            setClasses(cRes.data);
            setBanks(bRes.data);
        } catch {
            showToast("Failed to load exams", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openEdit = (ex: any) => {
        setEditTarget(ex);
        const totalMarks = Number(ex.total_marks ?? 0);
        const passingMarks = Number(ex.passing_marks ?? 0);
        const passingPercentage =
            totalMarks > 0
                ? Math.round((passingMarks / totalMarks) * 10000) / 100
                : Number(ex.passing_percentage ?? 40);
        setForm({
            ...emptyForm,
            ...ex,
            allowedCategories: ex.allowed_categories || [],
            allowedDifficulties: ex.allowed_difficulties || [],
            passingPercentage,
        });
        setShowForm(true);
    };

    const toggleDifficulty = (d: string) =>
        setForm((f: any) => ({
            ...f,
            allowedDifficulties: f.allowedDifficulties.includes(d)
                ? f.allowedDifficulties.filter((x: string) => x !== d)
                : [...f.allowedDifficulties, d],
        }));

    const buildPayload = () => {
        const totalMarks = Number(form.totalMarks);
        const passingPercentage = Number(form.passingPercentage);
        const passingMarks = totalMarks > 0
            ? Math.round((passingPercentage / 100) * totalMarks * 100) / 100
            : 0;
        return {
            ...form,
            durationMinutes: Number(form.durationMinutes),
            totalMarks,
            passingMarks,
            questionsPerStudent: Number(form.questionsPerStudent),
            maxViolations: Number(form.maxViolations),
            classId: form.classId || null,
            questionBankId: form.questionBankId || null,
            startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
            endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        };
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.questionBankId || !form.classId) {
            showToast("Title, class, and question bank are required", "error");
            return;
        }
        setSubmitting(true);
        try {
            if (editTarget) {
                await teacher.updateExam(editTarget.id, buildPayload());
                showToast("Exam updated", "success");
            } else {
                await teacher.createExam(buildPayload());
                showToast("Exam created", "success");
            }
            setShowForm(false);
            setEditTarget(null);
            setForm(emptyForm);
            load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to save exam", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setSubmitting(true);
        try {
            await teacher.deleteExam(deleteTarget.id);
            showToast("Exam deleted", "success");
            setDeleteTarget(null);
            load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to delete exam", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async () => {
        setSubmitting(true);
        try {
            await teacher.updateExamStatus(statusTarget.id, nextStatus);
            showToast("Status updated to " + nextStatus, "success");
            setStatusTarget(null);
            load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to update status", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const nextStatusFor = (s: string) => {
        if (s === "draft") return "scheduled";
        if (s === "scheduled") return "active";
        return "";
    };

    return (
        <DashboardLayout activeSection="Exams">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
                    <p className="text-sm text-gray-500">
                        Create, schedule, and manage exams
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditTarget(null);
                        setForm(emptyForm);
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                    <Plus size={16} /> Create Exam
                </button>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading exams..." />
            ) : exams.length === 0 ? (
                <EmptyState
                    icon={<BookOpen size={40} />}
                    title="No exams yet"
                    description="Create your first exam to get started."
                />
            ) : (
                <div className="space-y-3">
                    {exams.map((ex: any) => (
                        <div
                            key={ex.id}
                            className="card p-4 flex items-center justify-between gap-4"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-gray-900">
                                        {ex.title}
                                    </h3>
                                    <StatusBadge status={ex.status} />
                                </div>
                                <p className="text-sm text-gray-600">
                                    {ex.subject && ex.subject + " · "}
                                    {ex.duration_minutes} min · {ex.total_marks} marks ·
                                    {ex.passing_marks} to pass
                                </p>
                                <p className="text-xs text-gray-400">
                                    Starts: {formatDateTime(ex.start_at)} · Ends:{" "}
                                    {formatDateTime(ex.end_at)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {nextStatusFor(ex.status) && (
                                    <button
                                        onClick={() => {
                                            setStatusTarget(ex);
                                            setNextStatus(nextStatusFor(ex.status));
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100"
                                    >
                                        <Play size={14} /> Activate
                                    </button>
                                )}
                                <button
                                    onClick={() => openEdit(ex)}
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                                    title="Edit"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(ex)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editTarget ? "Edit Exam" : "Create Exam"}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Title *
                            </label>
                            <input
                                value={form.title}
                                onChange={(e) =>
                                    setForm({ ...form, title: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Mid-term Exam"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Subject
                            </label>
                            <input
                                value={form.subject}
                                onChange={(e) =>
                                    setForm({ ...form, subject: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Description
                        </label>
                        <textarea
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Class *
                            </label>
                            <select
                                value={form.classId}
                                onChange={(e) =>
                                    setForm({ ...form, classId: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select class</option>
                                {classes.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Question Bank *
                            </label>
                            <select
                                value={form.questionBankId}
                                onChange={(e) =>
                                    setForm({ ...form, questionBankId: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select bank</option>
                                {banks.map((b: any) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Duration (min)
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={form.durationMinutes}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        durationMinutes: e.target.value,
                                    })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Total Marks
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={form.totalMarks}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        totalMarks: e.target.value,
                                    })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Passing Percentage
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={form.passingPercentage}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            passingPercentage: e.target.value,
                                        })
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                                <span className="text-sm text-gray-500 flex-shrink-0">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Qs per Student
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={form.questionsPerStudent}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        questionsPerStudent: e.target.value,
                                    })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Start At
                            </label>
                            <input
                                type="datetime-local"
                                value={form.startAt}
                                onChange={(e) =>
                                    setForm({ ...form, startAt: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                End At
                            </label>
                            <input
                                type="datetime-local"
                                value={form.endAt}
                                onChange={(e) =>
                                    setForm({ ...form, endAt: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                            Allowed Difficulties
                        </label>
                        <div className="flex gap-3">
                            {["easy", "medium", "hard"].map((d) => (
                                <label
                                    key={d}
                                    className="flex items-center gap-2 text-sm text-gray-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.allowedDifficulties.includes(d)}
                                        onChange={() => toggleDifficulty(d)}
                                        className="rounded border-gray-300"
                                    />
                                    {d}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                            Security & Behavior
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ["shuffleQuestions", "Shuffle questions"],
                                ["shuffleOptions", "Shuffle options"],
                                ["requireFullscreen", "Require fullscreen"],
                                ["restrictCopy", "Restrict copy"],
                                ["restrictPaste", "Restrict paste"],
                                ["autoSubmitOnViolations", "Auto-submit on violations"],
                            ].map(([k, label]) => (
                                <label
                                    key={k}
                                    className="flex items-center gap-2 text-sm text-gray-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={(form as any)[k as keyof typeof form]}
                                        onChange={() =>
                                            setForm({
                                                ...(form as any),
                                                [k]: !(form as any)[k],
                                            })
                                        }
                                        className="rounded border-gray-300"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Max Violations
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={form.maxViolations}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        maxViolations: e.target.value,
                                    })
                                }
                                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Saving..." : "Save Exam"}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={!!deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Exam"
                message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
                confirmText="Delete"
            />

            <Modal
                open={!!statusTarget}
                onClose={() => setStatusTarget(null)}
                title="Activate Exam"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Set{" "}
                        <strong>{statusTarget?.title}</strong> to{" "}
                        <strong>{nextStatus}</strong>?
                    </p>
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={() => setStatusTarget(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStatusChange}
                            disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <CheckCircle size={16} />
                            {submitting ? "Updating..." : "Update"}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
