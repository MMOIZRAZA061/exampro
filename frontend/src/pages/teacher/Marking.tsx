import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { ClipboardList } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    StatusBadge,
    useToast,
    formatDateTime,
} from "../../components/ui";
import { teacher } from "../../services/api";

export default function TeacherMarking() {
    const [tab, setTab] = useState<"pending" | "completed">("pending");
    const [attempts, setAttempts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const loadAttempts = async () => {
        setLoading(true);
        try {
            const params =
                tab === "pending" ? { status: "submitted" } : { status: "completed" };
            const res = await teacher.attempts(params as any);
            setAttempts(res.data);
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to load attempts", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAttempts();
    }, [tab]);

    return (
        <DashboardLayout activeSection="Marking">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Marking</h1>
                    <p className="text-sm text-gray-500">Grade exam attempts and finalize results</p>
                </div>
                <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                    <button
                        onClick={() => setTab("pending")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "pending"
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setTab("completed")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "completed"
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        Completed
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20">
                    <LoadingSpinner text="Loading attempts..." />
                </div>
            ) : attempts.length === 0 ? (
                <EmptyState
                    icon={<ClipboardList size={40} />}
                    title="No attempts found"
                    description={
                        tab === "pending"
                            ? "There are no submitted attempts waiting for marking."
                            : "No attempts have been finalized yet."
                    }
                />
            ) : (
                <div className="card !p-0 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Exam</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Started</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {attempts.map((a) => (
                                <tr key={a.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-900 font-medium">{a.student_name || "Unknown"}</td>
                                    <td className="px-4 py-3 text-gray-700">{a.exam_title}</td>
                                    <td className="px-4 py-3 text-gray-600">{formatDateTime(a.started_at)}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={a.status} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => navigate(`/teacher/marking/${a.id}`)}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            {tab === "pending" ? "Mark" : "View"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardLayout>
    );
}
