import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BookOpen, Plus } from "lucide-react";
import { LoadingSpinner, EmptyState, Modal, StatusBadge, formatDate, useToast } from "../../components/ui";
import { admin } from "../../services/api";

export default function AdminClasses() {
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: "", subject: "", description: "", teacherId: "" });
    const { showToast } = useToast();

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        setLoading(true);
        try {
            const res = await admin.classes();
            setClasses(res.data);
        } catch {
            showToast("Failed to load classes", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            await admin.createClass(form);
            showToast("Class created successfully");
            setShowCreate(false);
            setForm({ name: "", subject: "", description: "", teacherId: "" });
            loadClasses();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to create class", "error");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await admin.deleteClass(id);
            showToast("Class deleted");
            loadClasses();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to delete class", "error");
        }
    };

    return (
        <DashboardLayout activeSection="Classes">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Classes</h2>
                    <p className="text-sm text-gray-500">Manage all classes</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    <Plus size={18} /> Create Class
                </button>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading classes..." />
            ) : classes.length === 0 ? (
                <EmptyState icon={<BookOpen size={40} />} title="No classes found" description="Create a class to get started." />
            ) : (
                <div className="card overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="table-header">Name</th>
                                <th className="table-header">Subject</th>
                                <th className="table-header">Teacher</th>
                                <th className="table-header">Students</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Created</th>
                                <th className="table-header text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {classes.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="table-cell font-medium text-gray-900">{c.name}</td>
                                    <td className="table-cell text-gray-600">{c.subject || "—"}</td>
                                    <td className="table-cell text-gray-600">{c.teacher_name || "—"}</td>
                                    <td className="table-cell text-gray-600">{c.student_count}</td>
                                    <td className="table-cell"><StatusBadge status={c.status} /></td>
                                    <td className="table-cell text-xs text-gray-500">{formatDate(c.created_at)}</td>
                                    <td className="table-cell text-right">
                                        <button onClick={() => handleDelete(c.id)} className="btn-danger text-xs !px-2 !py-1">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Class">
                <div className="space-y-3">
                    <div>
                        <label className="label">Class Name</label>
                        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Subject</label>
                        <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Description</label>
                        <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Teacher ID (optional)</label>
                        <input className="input" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} placeholder="UUID of teacher" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleCreate}>Create</button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
