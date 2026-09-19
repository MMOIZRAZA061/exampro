import { useState, FormEvent } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useToast } from "../../components/ui";
import { student } from "../../services/api";

export default function AdminProfile() {
    const { showToast } = useToast();
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const saveProfile = async (e: FormEvent) => {
        e.preventDefault();
        try {
            await student.updateProfile({ fullName: fullName || undefined, phone: phone || undefined, address: address || undefined });
            showToast("Profile updated successfully");
            setFullName("");
            setPhone("");
            setAddress("");
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to update profile", "error");
        }
    };

    const changePassword = async (e: FormEvent) => {
        e.preventDefault();
        try {
            await student.changePassword({ currentPassword, newPassword });
            showToast("Password changed successfully");
            setCurrentPassword("");
            setNewPassword("");
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to change password", "error");
        }
    };

    return (
        <DashboardLayout activeSection="Profile">
            <div className="max-w-2xl space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
                    <p className="text-sm text-gray-500">Update your personal information</p>
                </div>

                <form onSubmit={saveProfile} className="card space-y-4">
                    <div>
                        <label className="label">Full Name</label>
                        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                        <label className="label">Phone</label>
                        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
                    </div>
                    <div>
                        <label className="label">Address</label>
                        <textarea className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="btn-primary">Save Profile</button>
                    </div>
                </form>

                <form onSubmit={changePassword} className="card space-y-4">
                    <h3 className="font-semibold text-gray-900">Change Password</h3>
                    <div>
                        <label className="label">Current Password</label>
                        <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    </div>
                    <div>
                        <label className="label">New Password</label>
                        <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="btn-primary">Change Password</button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
