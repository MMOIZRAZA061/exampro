import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BookOpen } from "lucide-react";
import { LoadingSpinner, EmptyState, useToast } from "../../components/ui";
import { student } from "../../services/api";

export default function StudentClasses() {
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await student.classes();
            setClasses(res.data);
        } catch {
            showToast("Failed to load classes", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <DashboardLayout activeSection="My Classes">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
                <p className="text-sm text-gray-500">
                    Classes you are enrolled in
                </p>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading classes..." />
            ) : classes.length === 0 ? (
                <EmptyState
                    icon={<BookOpen size={40} />}
                    title="No classes found"
                    description="You are not enrolled in any classes yet."
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.map((c: any) => (
                        <div key={c.id} className="card p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                                    <BookOpen size={22} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        {c.name}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {c.subject}
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {c.description || "No description"}
                            </p>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>Teacher: {c.teacher_name}</p>
                                <p>Students: {c.total_students}</p>
                                <p>Status: {c.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
