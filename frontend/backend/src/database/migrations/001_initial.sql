-- ProExam Initial Migration
-- Creates all tables for the ProExam system

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- TEACHER PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_id VARCHAR(50),
  department VARCHAR(255),
  specialization VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_teacher_profiles_employee ON teacher_profiles(employee_id) WHERE employee_id IS NOT NULL;

-- ============================================
-- STUDENT PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_id VARCHAR(50) UNIQUE,
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
  address TEXT,
  phone VARCHAR(50),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_profiles_student_id ON student_profiles(student_id);

-- ============================================
-- CLASSES
-- ============================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  teacher_id UUID REFERENCES teacher_profiles(user_id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classes_name ON classes(name);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_status ON classes(status);

-- ============================================
-- CLASS STUDENTS (Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS class_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(class_id, student_id)
);

CREATE INDEX idx_class_students_class ON class_students(class_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);

-- ============================================
-- QUESTION BANKS
-- ============================================
CREATE TABLE IF NOT EXISTS question_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
  question_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_banks_teacher ON question_banks(teacher_id);
CREATE INDEX idx_question_banks_name ON question_banks(name);

-- ============================================
-- QUESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('mcq', 'multi_choice', 'true_false', 'short_answer', 'long_answer', 'fill_blank')),
  category VARCHAR(255),
  difficulty VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks INTEGER NOT NULL DEFAULT 1,
  correct_answer TEXT,
  explanation TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_bank ON questions(question_bank_id);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_category ON questions(category);

-- ============================================
-- QUESTION OPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label VARCHAR(5) NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_question_options_question ON question_options(question_id);

-- ============================================
-- EXAMS
-- ============================================
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  instructions TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  question_bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL DEFAULT 100,
  passing_marks INTEGER NOT NULL DEFAULT 50,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'published', 'archived')),
  -- Question selection settings
  questions_per_student INTEGER NOT NULL DEFAULT 20,
  allowed_categories JSONB,
  allowed_difficulties JSONB,
  shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
  shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
  -- Security settings
  require_fullscreen BOOLEAN NOT NULL DEFAULT FALSE,
  restrict_copy BOOLEAN NOT NULL DEFAULT TRUE,
  restrict_paste BOOLEAN NOT NULL DEFAULT TRUE,
  max_violations INTEGER NOT NULL DEFAULT 3,
  auto_submit_on_violations BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exams_class ON exams(class_id);
CREATE INDEX idx_exams_teacher ON exams(teacher_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_question_bank ON exams(question_bank_id);
CREATE INDEX idx_exams_start_at ON exams(start_at);

-- ============================================
-- EXAM QUESTIONS (Pooled Questions)
-- ============================================
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(exam_id, question_id)
);

CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);

-- ============================================
-- EXAM ATTEMPTS
-- ============================================
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  auto_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'auto_submitted', 'marking', 'completed')),
  total_obtained_marks INTEGER DEFAULT 0,
  total_possible_marks INTEGER DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  passed BOOLEAN,
  violation_count INTEGER NOT NULL DEFAULT 0,
  security_events_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(exam_id, student_id)
);

CREATE INDEX idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX idx_exam_attempts_status ON exam_attempts(status);

-- ============================================
-- EXAM ATTEMPT QUESTIONS (Assigned Questions per Student)
-- ============================================
CREATE TABLE IF NOT EXISTS exam_attempt_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_attempt_questions_attempt ON exam_attempt_questions(attempt_id);

-- ============================================
-- STUDENT ANSWERS
-- ============================================
CREATE TABLE IF NOT EXISTS student_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_question_id UUID NOT NULL REFERENCES exam_attempt_questions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  answer_text TEXT,
  selected_option_ids JSONB,
  is_correct BOOLEAN,
  auto_marked BOOLEAN NOT NULL DEFAULT FALSE,
  marks_awarded INTEGER,
  feedback TEXT,
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_answers_attempt ON student_answers(attempt_id);
CREATE INDEX idx_student_answers_attempt_question ON student_answers(attempt_question_id);
CREATE UNIQUE INDEX idx_student_answers_unique ON student_answers(attempt_question_id, student_id);

-- ============================================
-- RESULTS
-- ============================================
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES exam_attempts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  total_marks INTEGER NOT NULL,
  obtained_marks INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  grade VARCHAR(10),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_feedback TEXT,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_exam ON results(exam_id);
CREATE INDEX idx_results_attempt ON results(attempt_id);
CREATE INDEX idx_results_published ON results(published_at) WHERE published_at IS NOT NULL;

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================
-- SECURITY EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('focus_lost', 'tab_switched', 'visibility_changed', 'exam_left', 'exam_returned', 'copy_attempt', 'paste_attempt', 'fullscreen_exited', 'exam_submitted', 'violation')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_events_attempt ON security_events(attempt_id);
CREATE INDEX idx_security_events_student ON security_events(student_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
