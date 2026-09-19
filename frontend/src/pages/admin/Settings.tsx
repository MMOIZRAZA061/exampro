import DashboardLayout from "../../layouts/DashboardLayout";
import { Settings as SettingsIcon } from "lucide-react";

export default function AdminSettings() {
    return (
        <DashboardLayout activeSection="Settings">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">System Settings</h2>
                <div className="card p-8 text-center text-gray-500">
                    <SettingsIcon size={40} className="mx-auto mb-4 text-gray-400" />
                    <p>System settings are managed through environment variables and configuration.</p>
                </div>
            </div>
        </DashboardLayout>
    );
}
