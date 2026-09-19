import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { GraduationCap, Plus, Search } from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    Modal,
    StatusBadge,
    SearchInput,
    ConfirmDialog,
    useToast,
} from "../../components/ui";
import { useDebounce } from "../../services/hooks";
import { teacher } from "../../services/api";

export default function TeacherStudents() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [classes, setClasses] = useState<any[]>([]);
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        studentId: "",
        password: "",
    });
    const [classId, setClassId] = useState("");
    const [removeTarget, setRemoveTarget] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const navigateSearch = useDebounce(search, 300);
    const { showToast } = useToast();

    useEffect(() => {
        loadClasses();
    }, []);

    useEffect(() => {
        loadStudents();
    }, [navigateSearch]);

    const loadClasses = async () => {
        try {
            const res = await teacher.classes();
            setClasses(res.data);
        } catch {
            /* ignore */
        }
    };

    const loadStudents = async () => {
        setLoading(true);
        try {
            const res = await teacher.students({ search: navigateSearch || undefined });
            setStudents(res.data);
        } catch {
            showToast("Failed to load students", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!form.fullName || !form.email || !form.password) {
            showToast("Name, email, and password are required", "error");
            return;
        }
        setSubmitting(true);
        try {
            const created = await teacher.addStudent(form);
            if (classId) {
                await teacher.assignStudentToClass(created.data.id, classId);
            }
            showToast("Student created successfully");
            setShowAdd(false);
            setForm({ fullName: "", email: "", studentId: "", password: "" });
            setClassId("");
            loadStudents();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to create student", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAssign = async (studentId: string) => {
        if (!classId) return;
        try {
            await teacher.assignStudentToClass(studentId, classId);
            showToast("Student assigned to class");
            loadStudents();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to assign student", "error");
        }
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        setSubmitting(true);
        try {
            await teacher.removeStudentFromClass(removeTarget.studentId, removeTarget.classId);
            showToast("Student removed from class");
            setRemoveTarget(null);
            loadStudents();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to remove student", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout activeSection="Students">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Students</h2>
                    <p className="text-sm text-gray-500">Manage student accounts</p>
                </div>
                <div className="flex gap-2 items-center">
                    <SearchInput placeholder="Search students..." onSearch={setSearch} />
                    <button onClick={() => setShowAdd(true)} className="btn-primary whitespace-nowrap">
                        <Plus size={18} /> Add Student
                    </button>
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading students..." />
            ) : students.length === 0 ? (
                <EmptyState
                    icon={<GraduationCap size={40} />}
                    title="No students found"
                    description="Add your first student to get started."
                />
            ) : (
                <div className="card !p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className="table-header">Name</th>
                                    <th className="table-header">ID</th>
                                    <th className="table-header">Email</th>
                                    <th className="table-header">Status</th>
                                    <th className="table-header">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id} className="border-t border-gray-100">
                                        <td className="table-cell font-medium text-gray-900">{s.full_name}</td>
                                        <td className="table-cell">{s.student_id || "—"}</td>
                                        <td className="table-cell">{s.email}</td>
                                        <td className="table-cell">
                                            <StatusBadge status={s.status} />
                                        </td>
                                        <td className="table-cell">
                                            <button
                                                className="btn-secondary text-xs !px-2 !py-1"
                                                onClick={() => setSelected(s)}
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Student Modal */}
            <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Student">
                <div className="space-y-3">
                    <div>
                        <label className="label">Full Name *</label>
                        <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Student ID</label>
                        <input className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Email *</label>
                        <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Password *</label>
                        <input type="text" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Assign to Class (optional)</label>
                        <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                            <option value="">No class</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleAdd} disabled={submitting}>
                            {submitting ? "Creating..." : "Create Student"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Manage Modal */}
            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={`Manage — ${selected?.full_name || ""}`}
            >
                {selected && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {classes.map((c) => (
                                <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="text-sm">{c.name}</span>
                                    <button
                                        className="text-xs text-blue-600 hover:underline"
                                        onClick={() => handleAssign(selected.id)}
                                    >
                                        Assign
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="label">Remove from class</label>
                            <div className="flex gap-2">
                                <select
                                    className="input"
                                    value={classId}
                                    onChange={(e) => setClassId(e.target.value)}
                                >
                                    <option value="">Select a class...</option>
                                    {classes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="btn-danger whitespace-nowrap"
                                    disabled={!classId}
                                    onClick={() =>
                                        setRemoveTarget({
                                            studentId: selected.id,
                                            classId: classId,
                                            className: classes.find((c) => c.id === classId)?.name,
                                        })
                                    }
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={!!removeTarget}
                title="Remove from class"
                message={`Remove ${selected?.full_name || "student"} from ${removeTarget?.className}?`}
                confirmText="Remove"
                onConfirm={handleRemove}
                onCancel={() => setRemoveTarget(null)}
                loading={submitting}
            />
        </DashboardLayout>
    );
}
