import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { GraduationCap, Search } from "lucide-react";
import { LoadingSpinner, EmptyState, StatusBadge, formatDate, useToast } from "../../components/ui";
import { admin } from "../../services/api";
import { useDebounce } from "../../services/hooks";

export default function AdminStudents() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search);
    const { showToast } = useToast();

    useEffect(() => {
        loadStudents();
    }, [debouncedSearch]);

    const loadStudents = async () => {
        setLoading(true);
        try {
            const res = await admin.students({ search: debouncedSearch || undefined });
            setStudents(res.data);
        } catch {
            showToast("Failed to load students", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout activeSection="Students">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Students</h2>
                    <p className="text-sm text-gray-500">Manage student accounts</p>
                </div>
            </div>

            <div className="card mb-4 p-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search students..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading students..." />
            ) : students.length === 0 ? (
                <EmptyState icon={<GraduationCap size={40} />} title="No students found" description="Create students from the Users page." />
            ) : (
                <div className="card overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="table-header">Name</th>
                                <th className="table-header">Email</th>
                                <th className="table-header">Student ID</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {students.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    <td className="table-cell font-medium text-gray-900">{s.full_name}</td>
                                    <td className="table-cell text-gray-600">{s.email}</td>
                                    <td className="table-cell text-gray-600">{s.student_id || "—"}</td>
                                    <td className="table-cell"><StatusBadge status={s.status} /></td>
                                    <td className="table-cell text-xs text-gray-500">{formatDate(s.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardLayout>
    );
}
