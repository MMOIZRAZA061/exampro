import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { User, Search } from "lucide-react";
import { LoadingSpinner, EmptyState, StatusBadge, formatDate, useToast } from "../../components/ui";
import { admin } from "../../services/api";
import { useDebounce } from "../../services/hooks";

export default function AdminTeachers() {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search);
    const { showToast } = useToast();

    useEffect(() => {
        loadTeachers();
    }, [debouncedSearch]);

    const loadTeachers = async () => {
        setLoading(true);
        try {
            const res = await admin.teachers({ search: debouncedSearch || undefined });
            setTeachers(res.data);
        } catch {
            showToast("Failed to load teachers", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout activeSection="Teachers">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Teachers</h2>
                    <p className="text-sm text-gray-500">Manage teacher accounts</p>
                </div>
            </div>

            <div className="card mb-4 p-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search teachers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading teachers..." />
            ) : teachers.length === 0 ? (
                <EmptyState icon={<User size={40} />} title="No teachers found" description="Create teachers from the Users page." />
            ) : (
                <div className="card overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="table-header">Name</th>
                                <th className="table-header">Email</th>
                                <th className="table-header">Employee ID</th>
                                <th className="table-header">Department</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {teachers.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="table-cell font-medium text-gray-900">{t.full_name}</td>
                                    <td className="table-cell text-gray-600">{t.email}</td>
                                    <td className="table-cell text-gray-600">{t.employee_id || "—"}</td>
                                    <td className="table-cell text-gray-600">{t.department || "—"}</td>
                                    <td className="table-cell"><StatusBadge status={t.status} /></td>
                                    <td className="table-cell text-xs text-gray-500">{formatDate(t.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardLayout>
    );
}
