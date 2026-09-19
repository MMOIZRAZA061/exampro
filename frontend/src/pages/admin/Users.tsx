import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Users, Plus, Search, User as UserIcon, X } from "lucide-react";
import {
    StatCard,
    LoadingSpinner,
    EmptyState,
    SearchInput,
    Modal,
    ConfirmDialog,
    StatusBadge,
    formatDate,
    useToast,
} from "../../components/ui";
import { admin } from "../../services/api";
import { useDebounce } from "../../services/hooks";
import { useAuth } from "../../hooks/useAuth";

interface UserData {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    is_active: boolean;
    last_login_at?: string;
    created_at: string;
    employee_id?: string;
    department?: string;
    student_id?: string;
}

export default function AdminUsers() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const debouncedSearch = useDebounce(search);
    const { user: currentUser } = useAuth();
    const { showToast, toastComponent } = useToast();

    const [showCreate, setShowCreate] = useState(false);
    const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Create form
    const [form, setForm] = useState({
        email: "",
        password: "",
        fullName: "",
        role: "student",
        employeeId: "",
        studentId: "",
    });

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await admin.users({
                search: debouncedSearch || undefined,
                role: roleFilter || undefined,
                status: statusFilter || undefined,
                limit: 200,
            });
            setUsers(res.data);
        } catch {
            showToast("Failed to load users", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [debouncedSearch, roleFilter, statusFilter]);

    const handleCreate = async () => {
        try {
            await admin.createUser(form);
            showToast("User created successfully");
            setShowCreate(false);
            setForm({ email: "", password: "", fullName: "", role: "student", employeeId: "", studentId: "" });
            loadUsers();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to create user", "error");
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setDeleteLoading(true);
        try {
            await admin.deleteUser(deleteUser.id);
            showToast("User deleted");
            setDeleteUser(null);
            loadUsers();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to delete user", "error");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleToggleStatus = async (u: UserData) => {
        try {
            const newStatus = u.status === "active" ? "inactive" : "active";
            await admin.updateUser(u.id, { status: newStatus });
            showToast("Status updated");
            loadUsers();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to update status", "error");
        }
    };

    return (
        <DashboardLayout activeSection="Users">
            {toastComponent}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">All Users</h2>
                    <p className="text-sm text-gray-500">
                        Manage all system users by role and status
                    </p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    <Plus size={18} /> Add User
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-4 p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search by email or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="input w-auto"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="">All roles</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                </select>
                <select
                    className="input w-auto"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading users..." />
            ) : users.length === 0 ? (
                <EmptyState
                    icon={<Users size={40} />}
                    title="No users found"
                    description="Try adjusting your search or filters."
                />
            ) : (
                <div className="card overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="table-header">Name / Email</th>
                                <th className="table-header">Role</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Last Login</th>
                                <th className="table-header">Created</th>
                                <th className="table-header text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="table-cell">
                                        <p className="font-medium text-gray-900">{u.full_name}</p>
                                        <p className="text-xs text-gray-500">{u.email}</p>
                                    </td>
                                    <td className="table-cell">
                                        <span className="badge bg-blue-100 text-blue-800 capitalize">
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <StatusBadge status={u.status} />
                                    </td>
                                    <td className="table-cell text-xs text-gray-500">
                                        {u.last_login_at ? formatDate(u.last_login_at) : "Never"}
                                    </td>
                                    <td className="table-cell text-xs text-gray-500">
                                        {formatDate(u.created_at)}
                                    </td>
                                    <td className="table-cell text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleToggleStatus(u)}
                                                className="btn-secondary text-xs !px-2 !py-1"
                                                disabled={u.id === currentUser?.id}
                                            >
                                                {u.status === "active" ? "Deactivate" : "Activate"}
                                            </button>
                                            <button
                                                onClick={() => setDeleteUser(u)}
                                                className="btn-danger text-xs !px-2 !py-1"
                                                disabled={u.id === currentUser?.id}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New User">
                <div className="space-y-3">
                    <div>
                        <label className="label">Full Name</label>
                        <input
                            className="input"
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Email</label>
                        <input
                            type="email"
                            className="input"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Password</label>
                        <input
                            type="password"
                            className="input"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            minLength={6}
                        />
                    </div>
                    <div>
                        <label className="label">Role</label>
                        <select
                            className="input"
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                        >
                            <option value="admin">Admin</option>
                            <option value="teacher">Teacher</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                    {form.role === "teacher" && (
                        <div>
                            <label className="label">Employee ID (optional)</label>
                            <input
                                className="input"
                                value={form.employeeId}
                                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                            />
                        </div>
                    )}
                    {form.role === "student" && (
                        <div>
                            <label className="label">Student ID (optional)</label>
                            <input
                                className="input"
                                value={form.studentId}
                                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                            />
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={handleCreate}>
                            Create User
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={!!deleteUser}
                title="Delete User"
                message={`Are you sure you want to delete ${deleteUser?.full_name}? This action cannot be undone.`}
                confirmText="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteUser(null)}
                loading={deleteLoading}
            />
        </DashboardLayout>
    );
}
