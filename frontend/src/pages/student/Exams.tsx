import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FileText, Play, Clock } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    StatusBadge,
    useToast,
    formatDateTime,
} from "../../components/ui";
import { student } from "../../services/api";

type Tab = "all" | "upcoming" | "available" | "completed" | "results";

export default function StudentExams() {
    const [tab, setTab] = useState<Tab>("all");
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (tab !== "all") params.type = tab;
            const res = await student.exams(params);
            setExams(res.data);
        } catch {
            showToast("Failed to load exams", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [tab]);

    const canStart = (ex: any) => ex.status === "active" && !ex.attempt_id;
    const isInProgress = (ex: any) => ex.attempt_status === "in_progress";
    const isCompleted = (ex: any) =>
        ["submitted", "auto_submitted", "marking", "completed"].includes(
            ex.attempt_status || ""
        );
    const hasResult = (ex: any) => !!ex.result_published_at;

    const tabs: { key: Tab; label: string }[] = [
        { key: "all", label: "All" },
        { key: "upcoming", label: "Upcoming" },
        { key: "available", label: "Available" },
        { key: "completed", label: "Completed" },
        { key: "results", label: "Results" },
    ];

    return (
        <DashboardLayout activeSection="Exams">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Exams</h1>
                <p className="text-sm text-gray-500">
                    View, start, and track your exams
                </p>
            </div>

            <div className="flex bg-white rounded-lg border border-gray-200 p-1 mb-4 w-fit">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <LoadingSpinner text="Loading exams..." />
            ) : exams.length === 0 ? (
                <EmptyState
                    icon={<FileText size={40} />}
                    title="No exams found"
                    description="There are no exams matching this filter."
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
                                    {hasResult(ex) && (
                                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                            Result published
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">
                                    {ex.class_name} · {ex.subject} ·{" "}
                                    {ex.duration_minutes} min · {ex.total_marks} marks
                                </p>
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatDateTime(ex.start_at)}
                                    {ex.end_at ? ` — ${formatDateTime(ex.end_at)}` : ""}
                                </p>
                            </div>
                            <div className="shrink-0">
                                {isInProgress(ex) && (
                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/student/exams/${ex.id}/play`
                                            )
                                        }
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
                                    >
                                        <Play size={16} /> Resume
                                    </button>
                                )}
                                {canStart(ex) && (
                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/student/exams/${ex.id}/play`
                                            )
                                        }
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                                    >
                                        <Play size={16} /> Start Exam
                                    </button>
                                )}
                                {isCompleted(ex) && !hasResult(ex) && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-lg inline-block">
                                        Awaiting result
                                    </span>
                                )}
                                {hasResult(ex) && (
                                    <button
                                        onClick={() => navigate("/student/results")}
                                        className="text-xs text-indigo-600 hover:underline"
                                    >
                                        View result
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
