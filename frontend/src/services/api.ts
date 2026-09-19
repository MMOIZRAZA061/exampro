import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const url = error.config?.url || "";
        // A 401 from an auth/session call (or a request made without any
        // credentials) simply means "not logged in" — the router's
        // ProtectedRoute already redirects to /login. Doing a hard
        // window.location.href here on every 401 causes an infinite
        // full-page reload loop, so we only hard-redirect for genuine,
        // non-session API calls that explicitly carry a credential and
        // still come back unauthenticated (i.e. the token has expired).
        if (
            status === 401 &&
            url.includes("/auth/me") === false &&
            url.includes("/auth/login") === false &&
            error.config?.withCredentials === true
        ) {
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth
export const auth = {
    login: (data: { email: string; password: string }) =>
        api.post("/auth/login", data),
    registerStudent: (data: {
        fullName: string;
        email: string;
        password: string;
        studentId?: string;
        phone?: string;
    }) => api.post("/auth/register", data),
    logout: () => api.post("/auth/logout"),
    me: () => api.get("/auth/me"),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.post("/auth/change-password", { currentPassword, newPassword }),
};

// Admin
export const admin = {
    dashboard: () => api.get("/admin/dashboard"),
    users: (params?: any) => api.get("/admin/users", { params }),
    createUser: (data: any) => api.post("/admin/users", data),
    updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
    teachers: (params?: any) => api.get("/admin/teachers", { params }),
    students: (params?: any) => api.get("/admin/students", { params }),
    classes: () => api.get("/admin/classes"),
    getClass: (id: string) => api.get(`/admin/classes/${id}`),
    createClass: (data: any) => api.post("/admin/classes", data),
    updateClass: (id: string, data: any) => api.patch(`/admin/classes/${id}`, data),
    deleteClass: (id: string) => api.delete(`/admin/classes/${id}`),
    auditLogs: (params?: any) => api.get("/admin/audit-logs", { params }),
};

// Teacher
export const teacher = {
    dashboard: () => api.get("/teachers/dashboard"),
    students: (params?: any) => api.get("/teachers/students", { params }),
    getStudent: (id: string) => api.get(`/teachers/students/${id}`),
    addStudent: (data: any) => api.post("/teachers/students", data),
    assignStudentToClass: (studentId: string, classId: string) =>
        api.post(`/teachers/students/${studentId}/assign-to-class`, { classId }),
    removeStudentFromClass: (studentId: string, classId: string) =>
        api.delete(`/teachers/students/${studentId}/from-class/${classId}`),
    classes: () => api.get("/teachers/classes"),
    getClass: (id: string) => api.get(`/teachers/classes/${id}`),
    createClass: (data: any) => api.post("/teachers/classes", data),
    updateClass: (id: string, data: any) => api.patch(`/teachers/classes/${id}`, data),
    classMembers: (id: string) => api.get(`/teachers/classes/${id}/members`),
    questionBanks: (params?: any) =>
        api.get("/teachers/question-banks", { params }),
    importQuestionBank: (data: {
        fileContent: string;
        fileName: string;
        bankId?: string;
        name?: string;
        subject?: string;
        description?: string;
        questionType?: string;
        difficulty?: string;
        marks?: number;
        options?: { label: string; text: string }[];
        correctAnswer?: string;
        explanation?: string;
    }) => api.post("/teachers/question-banks/import", data),
    getQuestionBank: (id: string) => api.get(`/teachers/question-banks/${id}`),
    createQuestionBank: (data: any) => api.post("/teachers/question-banks", data),
    updateQuestionBank: (id: string, data: any) =>
        api.patch(`/teachers/question-banks/${id}`, data),
    deleteQuestionBank: (id: string) =>
        api.delete(`/teachers/question-banks/${id}`),
    questions: (params?: any) => api.get("/teachers/questions", { params }),
    getQuestion: (id: string) => api.get(`/teachers/questions/${id}`),
    createQuestion: (data: any) => api.post("/teachers/questions", data),
    updateQuestion: (id: string, data: any) =>
        api.patch(`/teachers/questions/${id}`, data),
    deleteQuestion: (id: string) => api.delete(`/teachers/questions/${id}`),
    exams: (params?: any) => api.get("/teachers/exams", { params }),
    getExam: (id: string) => api.get(`/teachers/exams/${id}`),
    createExam: (data: any) => api.post("/teachers/exams", data),
    updateExam: (id: string, data: any) => api.patch(`/teachers/exams/${id}`, data),
    updateExamStatus: (id: string, status: string) =>
        api.patch(`/teachers/exams/${id}/status`, { status }),
    deleteExam: (id: string) => api.delete(`/teachers/exams/${id}`),
    attempts: (params?: any) => api.get("/teachers/attempts", { params }),
    getAttempt: (id: string) => api.get(`/teachers/attempts/${id}`),
    markAnswer: (attemptId: string, data: any) =>
        api.post(`/teachers/attempts/${attemptId}/mark`, data),
    finalizeMarking: (attemptId: string) =>
        api.post(`/teachers/attempts/${attemptId}/finalize`),
    results: (params?: any) => api.get("/teachers/results", { params }),
    resultDetail: (resultId: string, studentId?: string) =>
        api.get(`/teachers/results/detail`, {
            params: studentId ? { resultId, studentId } : { resultId },
        }),
    publishResult: (id: string, teacherFeedback?: string) =>
        api.post(`/teachers/results/${id}/publish`, { teacherFeedback }),
    updateResult: (id: string, data: any) =>
        api.patch(`/teachers/results/${id}`, data),
};

// Exam Runtime
export const exam = {
    start: (examId: string) => api.post(`/exams/${examId}/start`),
    getAttempt: (examId: string) => api.get(`/exams/${examId}/attempt`),
    saveAnswer: (examId: string, data: any) =>
        api.post(`/exams/${examId}/answers`, data),
    submit: (examId: string, data: any) => api.post(`/exams/${examId}/submit`, data),
    reportSecurityEvent: (examId: string, data: any) =>
        api.post(`/exams/${examId}/security-event`, data),
};

// Student
export const student = {
    dashboard: () => api.get("/students/dashboard"),
    classes: () => api.get("/students/classes"),
    exams: (params?: any) => api.get("/students/exams", { params }),
    results: () => api.get("/students/results"),
    resultDetail: (resultId: string) =>
        api.get(`/students/results/detail`, { params: { resultId } }),
    profile: () => api.get("/students/profile"),
    updateProfile: (data: any) => api.patch("/students/profile", data),
    changePassword: (data: any) =>
        api.post("/students/profile/password", data),
};
