export type Role = "admin" | "teacher" | "student";

export interface User {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    status: string;
    isActive: boolean;
    lastLoginAt?: string;
}

export interface AuthUser {
    id: string;
    email: string;
    role: Role;
    fullName: string;
}

export interface TeacherProfile {
    user_id: string;
    employee_id?: string;
    department?: string;
    specialization?: string;
    bio?: string;
    email?: string;
    full_name?: string;
    status?: string;
    is_active?: boolean;
}

export interface StudentProfile {
    user_id: string;
    student_id?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    phone?: string;
    email?: string;
    full_name?: string;
    status?: string;
    is_active?: boolean;
}

export interface ClassItem {
    id: string;
    name: string;
    subject?: string;
    description?: string;
    teacher_id?: string;
    status: string;
    created_at: string;
    teacher_name?: string;
    student_count?: number;
}

export interface QuestionBank {
    id: string;
    name: string;
    subject?: string;
    description?: string;
    teacher_id: string;
    question_count: number;
    created_at: string;
    teacher_name?: string;
    actual_question_count?: number;
}

export type QuestionType =
    | "mcq"
    | "multi_choice"
    | "true_false"
    | "short_answer"
    | "long_answer"
    | "fill_blank";

export interface Question {
    id: string;
    question_bank_id: string;
    text: string;
    type: QuestionType;
    category?: string;
    difficulty: "easy" | "medium" | "hard";
    marks: number;
    correct_answer?: string;
    explanation?: string;
    created_at: string;
    bank_name?: string;
    option_count?: number;
    options?: QuestionOption[];
}

export interface QuestionOption {
    id: string;
    label: string;
    text: string;
    is_correct?: boolean;
}

export interface Exam {
    id: string;
    title: string;
    subject?: string;
    description?: string;
    instructions?: string;
    class_id?: string;
    question_bank_id: string;
    teacher_id: string;
    duration_minutes: number;
    total_marks: number;
    passing_marks: number;
    start_at?: string;
    end_at?: string;
    status: string;
    questions_per_student: number;
    allowed_categories?: string[];
    allowed_difficulties?: string[];
    shuffle_questions: boolean;
    shuffle_options: boolean;
    require_fullscreen: boolean;
    restrict_copy: boolean;
    restrict_paste: boolean;
    max_violations: number;
    auto_submit_on_violations: boolean;
    created_at: string;
    class_name?: string;
    bank_name?: string;
    teacher_name?: string;
    attempt_count?: number;
}

export interface ExamAttempt {
    id: string;
    exam_id: string;
    student_id: string;
    started_at: string;
    deadline_at: string;
    submitted_at?: string;
    auto_submitted: boolean;
    status: string;
    total_obtained_marks?: number;
    total_possible_marks?: number;
    percentage?: number;
    passed?: boolean;
    violation_count: number;
    exam_title?: string;
    duration_minutes?: number;
    total_marks?: number;
    passing_marks?: number;
    shuffle_options?: boolean;
    require_fullscreen?: boolean;
    restrict_copy?: boolean;
    restrict_paste?: boolean;
    max_violations?: number;
    auto_submit_on_violations?: boolean;
    instructions?: string;
    student_name?: string;
    student_email?: string;
    student_id_field?: string;
    questions?: AttemptQuestion[];
    resumed?: boolean;
}

export interface AttemptQuestion {
    attemptQuestionId: string;
    questionId: string;
    text: string;
    type: QuestionType;
    marks: number;
    category?: string;
    difficulty?: string;
    position: number;
    options: { id: string; label: string; text: string }[];
    answer?: {
        attemptQuestionId: string;
        answerText?: string | null;
        selectedOptionIds?: string[] | null;
        lastSavedAt?: string | null;
        marksAwarded?: number | null;
        feedback?: string | null;
        isCorrect?: boolean | null;
    };
}

export interface Result {
    id: string;
    attempt_id: string;
    student_id: string;
    exam_id: string;
    total_marks: number;
    obtained_marks: number;
    percentage: number;
    grade: string;
    passed: boolean;
    teacher_feedback?: string;
    published_at?: string;
    created_at: string;
    exam_title?: string;
    exam_subject?: string;
    student_name?: string;
}

export interface AuditLog {
    id: string;
    user_id?: string;
    action: string;
    entity_type?: string;
    entity_id?: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
    actor_name?: string;
    actor_email?: string;
}

export interface DashboardStats {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalExams: number;
    activeExams: number;
    completedExams: number;
    publishedResults: number;
}

export interface StudentDashboard {
    classes: ClassItem[];
    exams: any[];
    results: Result[];
    totalClasses: number;
    totalExams: number;
    publishedResults: number;
}

export interface MarkingAnswer {
    id: string;
    attempt_question_id: string;
    attempt_id: string;
    answer_text?: string;
    selected_option_ids?: string[];
    is_correct?: boolean;
    auto_marked: boolean;
    marks_awarded?: number;
    feedback?: string;
    position: number;
    question_text: string;
    type: QuestionType;
    marks: number;
    correct_answer?: string;
}
