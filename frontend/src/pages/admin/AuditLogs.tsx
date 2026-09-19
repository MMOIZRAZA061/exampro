import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { ScrollText } from "lucide-react";
import { LoadingSpinner, EmptyState, formatDateTime, useToast } from "../../components/ui";
import { admin } from "../../services/api";

export default function AdminAuditLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const { showToast } = useToast();

    useEffect(() => {
        loadLogs();
    }, [page]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const res = await admin.auditLogs({ page: page.toString(), limit: "50" });
            setLogs(res.data);
        } catch {
            showToast("Failed to load audit logs", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout activeSection="Audit Logs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
                    <p className="text-sm text-gray-500">
                        Track all administrative actions across the system
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        className="btn-secondary"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        Previous
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading audit logs..." />
            ) : logs.length === 0 ? (
                <EmptyState
                    icon={<ScrollText size={40} />}
                    title="No audit logs found"
                    description="Actions will appear here as they occur."
                />
            ) : (
                <div className="card overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="table-header">Action</th>
                                <th className="table-header">Entity</th>
                                <th className="table-header">Actor</th>
                                <th className="table-header">Details</th>
                                <th className="table-header">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="table-cell">
                                        <span className="badge bg-blue-100 text-blue-800">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="table-cell text-gray-600">
                                        {log.entity_type || "—"}
                                    </td>
                                    <td className="table-cell text-gray-600">
                                        {log.actor_name || "System"}
                                    </td>
                                    <td className="table-cell text-xs text-gray-500 max-w-xs truncate">
                                        {log.details ? JSON.stringify(log.details) : "—"}
                                    </td>
                                    <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                                        {formatDateTime(log.created_at)}
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
