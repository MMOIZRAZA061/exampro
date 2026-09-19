import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Trophy, Eye, FileText } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    StatusBadge,
    Modal,
    useToast,
    formatDateTime,
} from "../../components/ui";
import { student } from "../../services/api";
import AnswerReview from "../../components/AnswerReview";

export default function StudentResults() {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailTarget, setDetailTarget] = useState<any | null>(null);
    const [detailData, setDetailData] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const { showToast } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await student.results();
            setResults(res.data);
        } catch {
            showToast("Failed to load results", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openDetail = async (r: any) => {
        setDetailTarget(r);
        setDetailData(null);
        setDetailLoading(true);
        try {
            const res = await student.resultDetail(r.id);
            setDetailData(res.data);
        } catch {
            showToast("Failed to load details", "error");
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <DashboardLayout activeSection="Results">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Results</h1>
                <p className="text-sm text-gray-500">
                    Published results from your exams
                </p>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading results..." />
            ) : results.length === 0 ? (
                <EmptyState
                    icon={<Trophy size={40} />}
                    title="No results yet"
                    description="Your results will appear here once your teachers publish them."
                />
            ) : (
                <div className="space-y-3">
                    {results.map((r: any) => (
                        <div key={r.id} className="card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        {r.exam_title}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {r.exam_subject} ·{" "}
                                        {formatDateTime(r.exam_date)}
                                    </p>
                                </div>
                                <div
                                    className={`text-lg font-bold ${r.passed
                                        ? "text-emerald-600"
                                        : "text-red-600"
                                        }`}
                                >
                                    {r.percentage}%
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div>
                                        <span className="text-gray-400">Score:</span>{" "}
                                        <span
                                            className={`font-medium ${r.passed
                                                ? "text-emerald-600"
                                                : "text-red-600"
                                                }`}
                                        >
                                            {r.obtained_marks}/{r.total_marks}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">
                                            Passing Marks:
                                        </span>{" "}
                                        <span className="font-medium">
                                            {r.passing_marks ?? "—"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Status:</span>{" "}
                                        {r.passed ? (
                                            <StatusBadge status="passed" />
                                        ) : (
                                            <StatusBadge status="failed" />
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => openDetail(r)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100"
                                >
                                    <Eye size={12} /> View Details
                                </button>
                            </div>

                            {r.teacher_feedback && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-xs font-medium text-blue-700 mb-1">
                                        Teacher Feedback
                                    </p>
                                    <p className="text-sm text-blue-800">
                                        {r.teacher_feedback}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

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
                                    {detailTarget?.exam_title}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    {formatDateTime(detailData.attempt?.submitted_at)}
                                    {detailData.result?.grade
                                        ? ` · Grade ${detailData.result.grade}`
                                        : ""}
                                </p>
                            </div>
                            <div className="text-right">
                                <div
                                    className={`text-lg font-bold ${detailData.result?.passed
                                        ? "text-emerald-600"
                                        : "text-red-600"
                                        }`}
                                >
                                    {detailData.result?.obtained_marks}/
                                    {detailData.result?.total_marks}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {detailData.result?.percentage}%
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[55vh] overflow-y-auto pr-1">
                            <AnswerReview breakdown={detailData.breakdown} />
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
