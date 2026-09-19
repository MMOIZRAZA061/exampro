import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { GraduationCap, BookOpen, FileText, Clock, ClipboardList, Trophy } from "lucide-react";
import { StatCard, LoadingSpinner, useToast } from "../../components/ui";
import { teacher } from "../../services/api";

export default function TeacherDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await teacher.dashboard();
            setStats(res.data);
        } catch {
            showToast("Failed to load dashboard", "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <DashboardLayout activeSection="Dashboard"><LoadingSpinner text="Loading dashboard..." /></DashboardLayout>;
    if (!stats) return <DashboardLayout activeSection="Dashboard"><div className="text-gray-500">Failed to load dashboard</div></DashboardLayout>;

    return (
        <DashboardLayout activeSection="Dashboard">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Students" value={stats.totalStudents} icon={<GraduationCap size={22} />} color="blue" />
                <StatCard label="Total Classes" value={stats.totalClasses} icon={<BookOpen size={22} />} color="green" />
                <StatCard label="Total Exams" value={stats.totalExams} icon={<FileText size={22} />} color="purple" />
                <StatCard label="Upcoming Exams" value={stats.upcomingExams} icon={<Clock size={22} />} color="yellow" />
                <StatCard label="Active Exams" value={stats.activeExams} icon={<FileText size={22} />} color="red" />
                <StatCard label="Pending Marking" value={stats.pendingMarking} icon={<ClipboardList size={22} />} color="orange" />
                <StatCard label="Published Results" value={stats.publishedResults} icon={<Trophy size={22} />} color="blue" />
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                    <button onClick={loadStats} className="btn-secondary">Refresh</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button className="btn-secondary" onClick={() => navigate("/teacher/question-banks")}>
                        Question Banks
                    </button>
                    <button className="btn-secondary" onClick={() => navigate("/teacher/exams")}>
                        Exams
                    </button>
                    <button className="btn-secondary" onClick={() => navigate("/teacher/marking")}>
                        Marking
                    </button>
                    <button className="btn-secondary" onClick={() => navigate("/teacher/results")}>
                        Results
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
}
