import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
    BookOpen,
    FileText,
    Clock,
    Trophy,
    Play,
} from "lucide-react";
import { StatCard, LoadingSpinner, useToast, formatDateTime } from "../../components/ui";
import { student } from "../../services/api";

export default function StudentDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await student.dashboard();
            setData(res.data);
        } catch {
            showToast("Failed to load dashboard", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (loading)
        return (
            <DashboardLayout activeSection="Dashboard">
                <LoadingSpinner text="Loading dashboard..." />
            </DashboardLayout>
        );

    if (!data)
        return (
            <DashboardLayout activeSection="Dashboard">
                <div className="text-gray-500">Failed to load dashboard</div>
            </DashboardLayout>
        );

    return (
        <DashboardLayout activeSection="Dashboard">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="My Classes"
                    value={data.totalClasses}
                    icon={<BookOpen size={22} />}
                    color="blue"
                />
                <StatCard
                    label="Total Exams"
                    value={data.totalExams}
                    icon={<FileText size={22} />}
                    color="purple"
                />
                <StatCard
                    label="Published Results"
                    value={data.publishedResults}
                    icon={<Trophy size={22} />}
                    color="green"
                />
            </div>

            <div className="space-y-4">
                <div className="card">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">
                            Upcoming / Available Exams
                        </h3>
                        <button
                            onClick={load}
                            className="text-xs text-indigo-600 hover:underline"
                        >
                            Refresh
                        </button>
                    </div>
                    {data.exams.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No upcoming exams found.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {data.exams.slice(0, 5).map((ex: any) => (
                                <div
                                    key={ex.id}
                                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {ex.title}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {ex.class_name} · {ex.duration_minutes} min
                                            {" · "}
                                            <Clock size={12} className="inline" />
                                            {" "}
                                            {formatDateTime(ex.start_at)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {ex.has_attempt && (
                                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                In progress
                                            </span>
                                        )}
                                        {ex.status === "active" && !ex.has_attempt && (
                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/student/exams/${ex.id}/play`
                                                    )
                                                }
                                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700"
                                            >
                                                <Play size={12} /> Start
                                            </button>
                                        )}
                                        {ex.status === "scheduled" && (
                                            <span className="text-xs text-gray-500">
                                                {ex.status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">
                            My Classes
                        </h3>
                        <button
                            onClick={() => navigate("/student/classes")}
                            className="text-xs text-indigo-600 hover:underline"
                        >
                            View all
                        </button>
                    </div>
                    {data.classes.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            You are not enrolled in any classes yet.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {data.classes.map((c: any) => (
                                <div
                                    key={c.id}
                                    className="p-3 border border-gray-200 rounded-lg"
                                >
                                    <p className="font-medium text-gray-900">
                                        {c.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {c.subject} · {c.teacher_name}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">
                            Recent Results
                        </h3>
                        <button
                            onClick={() => navigate("/student/results")}
                            className="text-xs text-indigo-600 hover:underline"
                        >
                            View all
                        </button>
                    </div>
                    {data.results.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No published results yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {data.results.slice(0, 5).map((r: any) => (
                                <div
                                    key={r.id}
                                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {r.exam_title}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {r.published_at}
                                        </p>
                                    </div>
                                    <div
                                        className={`font-semibold ${r.passed
                                            ? "text-emerald-600"
                                            : "text-red-600"
                                            }`}
                                    >
                                        {r.obtained_marks}/
                                        {r.total_marks}{" "}
                                        ({r.percentage}%)
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
