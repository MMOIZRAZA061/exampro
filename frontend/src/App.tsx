import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Shared
import LoginPage from "./pages/Login";

// Admin
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminTeachers from "./pages/admin/Teachers";
import AdminStudents from "./pages/admin/Students";
import AdminClasses from "./pages/admin/Classes";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import AdminProfile from "./pages/admin/Profile";
import AdminSettings from "./pages/admin/Settings";

// Teacher
import TeacherDashboard from "./pages/teacher/Dashboard";
import TeacherClasses from "./pages/teacher/Classes";
import TeacherStudents from "./pages/teacher/Students";
import TeacherQuestionBanks from "./pages/teacher/QuestionBanks";
import TeacherQuestions from "./pages/teacher/Questions";
import TeacherExams from "./pages/teacher/Exams";
import TeacherMarking from "./pages/teacher/Marking";
import TeacherMarkingDetail from "./pages/teacher/MarkingDetail";
import TeacherResults from "./pages/teacher/Results";
import TeacherProfile from "./pages/teacher/Profile";

// Student
import StudentDashboard from "./pages/student/Dashboard";
import StudentClasses from "./pages/student/Classes";
import StudentExams from "./pages/student/Exams";
import ExamPlayer from "./pages/student/ExamPlayer";
import StudentResults from "./pages/student/Results";
import StudentProfile from "./pages/student/Profile";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Exam player - no dashboard layout, protected but full-screen */}
            <Route
                path="/student/exams/:examId/play"
                element={
                    <ProtectedRoute roles={["student"]}>
                        <ExamPlayer />
                    </ProtectedRoute>
                }
            />

            {/* Admin */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminUsers />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/teachers"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminTeachers />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/students"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminStudents />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/classes"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminClasses />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/audit-logs"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminAuditLogs />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/settings"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminSettings />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/profile"
                element={
                    <ProtectedRoute roles={["admin"]}>
                        <AdminProfile />
                    </ProtectedRoute>
                }
            />

            {/* Teacher */}
            <Route
                path="/teacher"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/classes"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherClasses />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/students"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherStudents />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/question-banks"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherQuestionBanks />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/questions"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherQuestions />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/exams"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherExams />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/marking"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherMarking />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/marking/:attemptId"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherMarkingDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/results"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherResults />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/profile"
                element={
                    <ProtectedRoute roles={["teacher"]}>
                        <TeacherProfile />
                    </ProtectedRoute>
                }
            />

            {/* Student */}
            <Route
                path="/student"
                element={
                    <ProtectedRoute roles={["student"]}>
                        <StudentDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/classes"
                element={
                    <ProtectedRoute roles={["student"]}>
                        <StudentClasses />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/exams"
                element={
                    <ProtectedRoute roles={["student"]}>
                        <StudentExams />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/results"
                element={
                    <ProtectedRoute roles={["student"]}>
                        <StudentResults />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/profile"
                element={
                    <ProtectedRoute roles={["student"]}>
                        <StudentProfile />
                    </ProtectedRoute>
                }
            />

            {/* Root redirect */}
            <Route
                path="/"
                element={<Navigate to="/login" replace />}
            />
            <Route
                path="*"
                element={<Navigate to="/login" replace />}
            />
        </Routes>
    );
}
