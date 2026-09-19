import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { LayoutDashboard, Users, GraduationCap, BookOpen, FileText, Trophy, Clock, CheckCircle } from "lucide-react";
import { StatCard, LoadingSpinner, useToast } from "../../components/ui";
import { admin } from "../../services/api";
import { DashboardStats } from "../../types";

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const loadStats = async () => {
        try {
            const res = await admin.dashboard();
            setStats(res.data);
        } catch {
            showToast("Failed to load dashboard", "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <DashboardLayout activeSection="Dashboard"><LoadingSpinner text="Loading dashboard..." /></DashboardLayout>;
    if (!stats) return <DashboardLayout activeSection="Dashboard"><div className="text-gray-500">No data</div></DashboardLayout>;

    return (
        <DashboardLayout activeSection="Dashboard">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Students" value={stats.totalStudents} icon={<GraduationCap size={22} />} color="blue" />
                <StatCard label="Total Teachers" value={stats.totalTeachers} icon={<Users size={22} />} color="green" />
                <StatCard label="Total Classes" value={stats.totalClasses} icon={<BookOpen size={22} />} color="purple" />
                <StatCard label="Total Exams" value={stats.totalExams} icon={<FileText size={22} />} color="yellow" />
                <StatCard label="Active Exams" value={stats.activeExams} icon={<Clock size={22} />} color="red" />
                <StatCard label="Completed Exams" value={stats.completedExams} icon={<CheckCircle size={22} />} color="green" />
                <StatCard label="Published Results" value={stats.publishedResults} icon={<Trophy size={22} />} color="blue" />
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">System Overview</h3>
                    <button onClick={loadStats} className="btn-secondary">Refresh</button>
                </div>
                <p className="text-sm text-gray-500">
                    Welcome to the ProExam admin dashboard. Use the sidebar to manage teachers, students, users, classes, and audit logs.
                </p>
            </div>
        </DashboardLayout>
    );
}
