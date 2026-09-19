import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BookOpen, Plus, Users } from "lucide-react";
import { LoadingSpinner, EmptyState, Modal, StatusBadge, formatDate, useToast } from "../../components/ui";
import { teacher } from "../../services/api";

export default function TeacherClasses() {
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedClass, setSelectedClass] = useState<any | null>(null);
    const [classMembers, setClassMembers] = useState<any[]>([]);
    const [showMembers, setShowMembers] = useState(false);
    const [form, setForm] = useState({ name: "", subject: "", description: "" });
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        setLoading(true);
        try {
            const res = await teacher.classes();
            setClasses(res.data);
        } catch {
            showToast("Failed to load classes", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async (classId: string) => {
        try {
            const res = await teacher.classMembers(classId);
            setClassMembers(res.data);
        } catch {
            showToast("Failed to load members", "error");
        }
    };

    const handleCreate = async () => {
        try {
            await teacher.createClass(form);
            showToast("Class created successfully");
            setShowCreate(false);
            setForm({ name: "", subject: "", description: "" });
            loadClasses();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to create class", "error");
        }
    };

    const handleViewMembers = (c: any) => {
        setSelectedClass(c);
        setShowMembers(true);
        loadMembers(c.id);
    };

    return (
        <DashboardLayout activeSection="Classes">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">My Classes</h2>
                    <p className="text-sm text-gray-500">Create and manage your classes</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    <Plus size={18} /> Create Class
                </button>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading classes..." />
            ) : classes.length === 0 ? (
                <EmptyState icon={<BookOpen size={40} />} title="No classes found" description="Create your first class to get started." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.map((c) => (
                        <div key={c.id} className="card">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                                    <p className="text-sm text-gray-500">{c.subject || "No subject"}</p>
                                </div>
                                <StatusBadge status={c.status} />
                            </div>
                            {c.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{c.description}</p>
                            )}
                            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                                <span className="flex items-center gap-1">
                                    <Users size={14} /> {c.student_count} students
                                </span>
                                <span>Created {formatDate(c.created_at)}</span>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn-secondary text-xs flex-1" onClick={() => handleViewMembers(c)}>
                                    View Members
                                </button>
                                <button
                                    className="btn-primary text-xs flex-1"
                                    onClick={() => navigate(`/teacher/exams/new?classId=${c.id}`)}
                                >
                                    Create Exam
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
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
                    <div className="flex justify-end gap-2 pt-2">
                        <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleCreate}>Create</button>
                    </div>
                </div>
            </Modal>

            {/* Members Modal */}
            <Modal
                open={showMembers}
                onClose={() => setShowMembers(false)}
                title={`Members — ${selectedClass?.name || ""}`}
            >
                {classMembers.length === 0 ? (
                    <p className="text-gray-500">No students in this class yet.</p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {classMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">{m.full_name}</p>
                                    <p className="text-xs text-gray-500">{m.student_id || m.email}</p>
                                </div>
                                <button
                                    className="btn-danger text-xs !px-2 !py-1"
                                    onClick={async () => {
                                        await teacher.removeStudentFromClass(m.id, selectedClass.id);
                                        loadMembers(selectedClass.id);
                                        showToast("Student removed");
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </DashboardLayout>
    );
}
