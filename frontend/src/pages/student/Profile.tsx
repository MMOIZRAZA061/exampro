import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { UserCircle, Save } from "lucide-react";
import { LoadingSpinner, useToast, formatDate } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { student } from "../../services/api";

export default function StudentProfile() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const load = async () => {
        try {
            const res = await student.profile();
            const p = res.data;
            setProfile(p);
            setFullName(p.full_name || "");
            setPhone(p.phone || "");
            setAddress(p.address || "");
        } catch {
            if (user) {
                setProfile(user as any);
                setFullName((user as any).full_name || "");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: any = {};
            if (fullName) payload.fullName = fullName;
            if (phone) payload.phone = phone;
            if (address) payload.address = address;
            await student.updateProfile(payload);
            showToast("Profile updated", "success");
            load();
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to update profile", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            showToast("New password must be at least 6 characters", "error");
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }
        setSubmitting(true);
        try {
            await student.changePassword({
                currentPassword,
                newPassword,
            });
            showToast("Password updated", "success");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (e: any) {
            showToast(e.response?.data?.message || "Failed to change password", "error");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout activeSection="Profile">
                <LoadingSpinner text="Loading profile..." />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout activeSection="Profile">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
                <p className="text-sm text-gray-500">
                    Manage your personal information and password
                </p>
            </div>

            <div className="space-y-6 max-w-3xl">
                <div className="card p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <UserCircle size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {fullName || user?.fullName}
                            </h3>
                            <p className="text-sm text-gray-500">{user?.email}</p>
                            {profile?.last_login_at && (
                                <p className="text-xs text-gray-400">
                                    Last login: {formatDate(profile.last_login_at)}
                                </p>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Full Name
                            </label>
                            <input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Phone
                            </label>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Address
                            </label>
                            <input
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Save size={16} />
                                {submitting ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="card p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        Change Password
                    </h3>
                    <form onSubmit={handlePassword} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                            >
                                {submitting ? "Updating..." : "Update Password"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}
