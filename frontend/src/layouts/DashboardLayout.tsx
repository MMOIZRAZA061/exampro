import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    FileText,
    ClipboardList,
    ScrollText,
    Settings,
    LogOut,
    Menu,
    X,
    UserCircle,
    BookMarked,
    CalendarClock,
    Trophy,
    Shield,
    User,
    ListChecks,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { admin } from "../services/api";

interface NavItem {
    label: string;
    icon: ReactNode;
    to: string;
    end?: boolean;
}

function getAdminNav(): NavItem[] {
    return [
        { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/admin", end: true },
        { label: "Teachers", icon: <User size={18} />, to: "/admin/teachers" },
        { label: "Students", icon: <GraduationCap size={18} />, to: "/admin/students" },
        { label: "Users", icon: <Users size={18} />, to: "/admin/users" },
        { label: "Classes", icon: <BookOpen size={18} />, to: "/admin/classes" },
        { label: "Audit Logs", icon: <ScrollText size={18} />, to: "/admin/audit-logs" },
        { label: "Settings", icon: <Settings size={18} />, to: "/admin/settings" },
        { label: "Profile", icon: <UserCircle size={18} />, to: "/admin/profile" },
    ];
}

function getTeacherNav(): NavItem[] {
    return [
        { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/teacher", end: true },
        { label: "Students", icon: <GraduationCap size={18} />, to: "/teacher/students" },
        { label: "Classes", icon: <BookOpen size={18} />, to: "/teacher/classes" },
        { label: "Question Banks", icon: <BookMarked size={18} />, to: "/teacher/question-banks" },
        { label: "Questions", icon: <ListChecks size={18} />, to: "/teacher/questions" },
        { label: "Exams", icon: <FileText size={18} />, to: "/teacher/exams" },
        { label: "Marking", icon: <ClipboardList size={18} />, to: "/teacher/marking" },
        { label: "Results", icon: <Trophy size={18} />, to: "/teacher/results" },
        { label: "Profile", icon: <UserCircle size={18} />, to: "/teacher/profile" },
    ];
}

function getStudentNav(): NavItem[] {
    return [
        { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/student", end: true },
        { label: "My Classes", icon: <BookOpen size={18} />, to: "/student/classes" },
        { label: "Exams", icon: <FileText size={18} />, to: "/student/exams" },
        { label: "Results", icon: <Trophy size={18} />, to: "/student/results" },
        { label: "Profile", icon: <UserCircle size={18} />, to: "/student/profile" },
    ];
}

export default function DashboardLayout({
    children,
    activeSection,
}: {
    children: ReactNode;
    activeSection?: string;
}) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (!user) return null;

    const navItems =
        user.role === "admin"
            ? getAdminNav()
            : user.role === "teacher"
                ? getTeacherNav()
                : getStudentNav();

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                    }`}
            >
                <div className="h-16 flex items-center px-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white rounded-lg p-2">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 text-sm">ProExam</h1>
                            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                    </div>
                    <button
                        className="ml-auto lg:hidden text-gray-500 hover:text-gray-700"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="p-2 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                    ? "bg-blue-50 text-blue-700 font-medium"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }`
                            }
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-gray-200 space-y-1">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-20 h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6">
                    <button
                        className="lg:hidden text-gray-500 hover:text-gray-700 mr-4"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>
                    <div className="flex-1">
                        <h2 className="font-semibold text-gray-900 capitalize">
                            {activeSection || "Dashboard"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block">
                            <p className="text-sm font-medium text-gray-700">
                                {user.fullName}
                            </p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <div className="bg-blue-100 text-blue-700 rounded-full h-9 w-9 flex items-center justify-center font-medium text-sm">
                            {user.fullName?.[0] || "U"}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}

export { getAdminNav, getTeacherNav, getStudentNav };
