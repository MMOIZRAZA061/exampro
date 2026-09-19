import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BarChart, Send, Pencil, X, Eye, FileText } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    Modal,
    ConfirmDialog,
    SearchInput,
    StatusBadge,
    useToast,
    formatDateTime,
} from "../../components/ui";
import { teacher } from "../../services/api";
import AnswerReview from "../../components/AnswerReview";

export default function TeacherResults() {
    const [results, setResults] = useState<any[]>([]);
    const [exams, setExams] = useState<any[]>([]);
    const [detailTarget, setDetailTarget] = useState<any | null>(null);
    const [detailData, setDetailData] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [examFilter, setExamFilter] = useState("");
    const [search, setSearch] = useState("");
    const [publishTarget, setPublishTarget] = useState<any | null>(null);
    const [feedback, setFeedback] = useState("");
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [editFeedback, setEditFeedback] = useState("");
    const [editGrade, setEditGrade] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (examFilter) params.examId = examFilter;
            const [rRes, eRes] = await Promise.all([
                teacher.results(params),
                teacher.exams(),
            ]);
            setResults(rRes.data);
            setExams(eRes.data);
        } catch (e: any) {
            showToast(
                e.response?.data?.message || "Failed to load results",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [examFilter]);

    const openPublish = (r: any) => {
        setPublishTarget(r);
        setFeedback(r.teacher_feedback || "");
    };

    const handlePublish = async () => {
        if (!publishTarget) return;
        setSubmitting(true);
        try {
            await teacher.publishResult(
                publishTarget.id,
                feedback || undefined
            );
            showToast("Result published", "success");
            setPublishTarget(null);
            load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to publish", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const openDetail = async (r: any) => {
        setDetailTarget(r);
        setDetailData(null);
        setDetailLoading(true);
        try {
            const res = await teacher.resultDetail(r.id, r.student_id);
            setDetailData(res.data);
        } catch (e: any) {
            showToast(
                e.response?.data?.message || "Failed to load details",
                "error"
            );
        } finally {
            setDetailLoading(false);
        }
    };

    const openEdit = (r: any) => {
        setEditTarget(r);
        setEditFeedback(r.teacher_feedback || "");
        setEditGrade(r.grade || "");
    };

    const handleSaveEdit = async () => {
        if (!editTarget) return;
        setSubmitting(true);
        try {
            await teacher.updateResult(editTarget.id, {
                teacherFeedback: editFeedback,
                grade: editGrade || undefined,
            });
            showToast("Result updated", "success");
            setEditTarget(null);
            load();
        } catch (e: any) {
            showToast(
                e.response?.data?.message || "Failed to update result",
                "error"
            );
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = results.filter(
        (r) =>
            !search ||
            r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.exam_title?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <DashboardLayout activeSection="Results">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Results
                    </h1>
                    <p className="text-sm text-gray-500">
                        Review and publish student exam results
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                    value={examFilter}
                    onChange={(e) => setExamFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-64"
                >
                    <option value="">All exams</option>
                    {exams.map((e) => (
                        <option key={e.id} value={e.id}>
                            {e.title}
                        </option>
                    ))}
                </select>
                <SearchInput
                    placeholder="Search student or exam..."
                    onSearch={(v: string) => setSearch(v)}
                />
            </div>

            {loading ? (
                <LoadingSpinner text="Loading results..." />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<BarChart size={40} />}
                    title="No results yet"
                    description="Results appear after exams are completed and marked."
                />
            ) : (
                <div className="card !p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Student
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Exam
                                    </th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-600">
                                        Score
                                    </th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-600">
                                        %
                                    </th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-600">
                                        Status
                                    </th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {r.student_name || "Unknown"}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {r.exam_title}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`font-semibold ${r.passed
                                                    ? "text-emerald-600"
                                                    : "text-red-600"
                                                    }`}
                                            >
                                                {r.obtained_marks}/
                                                {r.total_marks}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-700">
                                            {r.percentage}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {r.published_at ? (
                                                <StatusBadge status="published" />
                                            ) : r.passed ? (
                                                <StatusBadge status="passed" />
                                            ) : (
                                                <StatusBadge status="failed" />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openDetail(r)}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-100"
                                                    title="View detailed result"
                                                >
                                                    <Eye size={12} /> View
                                                </button>
                                                <button
                                                    onClick={() => openEdit(r)}
                                                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                {!r.published_at && (
                                                    <button
                                                        onClick={() =>
                                                            openPublish(r)
                                                        }
                                                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100"
                                                    >
                                                        <Send size={12} /> Publish
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Modal
                open={!!publishTarget}
                onClose={() => setPublishTarget(null)}
                title="Publish Result"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Publishing makes this result visible to{" "}
                        <strong>{publishTarget?.student_name}</strong>. This action
                        cannot be undone.
                    </p>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Teacher Feedback
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Add any feedback for the student..."
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={() => setPublishTarget(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Send size={14} />
                            {submitting ? "Publishing..." : "Publish"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!editTarget}
                onClose={() => setEditTarget(null)}
                title="Edit Result"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Grade
                        </label>
                        <input
                            value={editGrade}
                            onChange={(e) => setEditGrade(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="A, B, C..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Teacher Feedback
                        </label>
                        <textarea
                            value={editFeedback}
                            onChange={(e) => setEditFeedback(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={() => setEditTarget(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveEdit}
                            disabled={submitting}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!detailTarget}
                onClose={() => setDetailTarget(null)}
                title="Detailed Result"
            >
                {detailLoading ? (
                    <LoadingSpinner text="Loading details..." />
                ) : detailData ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    {detailTarget?.student_name}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    {detailData.result?.exam_title} ·{" "}
                                    {formatDateTime(
                                        detailData.attempt?.submitted_at
                                    )}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">
                                    {detailData.result?.obtained_marks}/
                                    {detailData.result?.total_marks}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {detailData.result?.percentage}%
                                    {detailData.result?.grade
                                        ? ` · Grade ${detailData.result.grade}`
                                        : ""}
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[55vh] overflow-y-auto pr-1">
                            <AnswerReview
                                breakdown={detailData.breakdown}
                                showTeacherInfo
                            />
                        </div>

                        {detailData.result?.teacher_feedback && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs font-medium text-blue-700 mb-1">
                                    <FileText
                                        size={12}
                                        className="inline mr-1"
                                    />{" "}
                                    Teacher Feedback
                                </p>
                                <p className="text-sm text-blue-800">
                                    {detailData.result.teacher_feedback}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState
                        title="No detail data"
                        description="Failed to load the breakdown."
                    />
                )}
            </Modal>
        </DashboardLayout>
    );
}
