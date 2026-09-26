-- =============================================
-- SMDL College Attendance System - Initial Migration
-- Database: PostgreSQL (Supabase)
-- =============================================

-- Run this SQL in Supabase SQL Editor after creating your project

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Enums
-- =============================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM (
    'PRESENT', 'ABSENT', 'PENDING_REVIEW',
    'TEACHER_ADDED', 'TEACHER_MODIFIED', 'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- users table
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  role user_role NOT NULL DEFAULT 'student',
  status account_status NOT NULL DEFAULT 'ACTIVE',
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- courses table
-- =============================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  duration_years INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- divisions table
-- =============================================
CREATE TABLE IF NOT EXISTS divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  division_name VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, name, division_name)
);

-- =============================================
-- subjects table
-- =============================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- students table
-- =============================================
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  course_id UUID REFERENCES courses(id),
  division_id UUID REFERENCES divisions(id),
  date_of_birth DATE,
  guardian_name VARCHAR(150),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- teachers table
-- =============================================
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  teacher_id VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(100),
  designation VARCHAR(100),
  registration_submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- teacher_subjects
-- =============================================
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id)
);

-- =============================================
-- lectures
-- =============================================
CREATE TABLE IF NOT EXISTS lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
  lecture_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  topic TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- attendance
-- =============================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'ABSENT',
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by UUID REFERENCES users(id),
  location_verified BOOLEAN DEFAULT FALSE,
  selfie_url TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  geofence_radius INT,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'AUTO_VERIFIED',
  UNIQUE(lecture_id, student_id)
);

-- =============================================
-- attendance_audit_logs
-- =============================================
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES users(id) NOT NULL,
  old_status attendance_status,
  new_status attendance_status NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- announcements
-- =============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- notifications
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- system_config
-- =============================================
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Default System Config (SMDL College, Kalamboli)
-- Note: Update these coordinates with actual college GPS coordinates!
-- =============================================
INSERT INTO system_config (config_key, config_value, description) VALUES
('college_name', 'SMDL College, Kalamboli', 'College Display Name'),
('college_address', 'Kalamboli, Maharashtra', 'College Address'),
('college_latitude', '19.0440', 'College GPS Latitude (update to actual!)'),
('college_longitude', '73.1142', 'College GPS Longitude (update to actual!)'),
('geofence_radius_meters', '200', 'Allowed attendance radius in meters')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_attendance_lecture_student ON attendance(lecture_id, student_id);
CREATE INDEX IF NOT EXISTS idx_lectures_subject_date ON lectures(subject_id, lecture_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

-- =============================================
-- Seed: Default Admin Account (Change password later!)
-- For demo purposes only.
-- User: admin@smdlcollege.edu.in / Admin@123
-- =============================================
-- NOTE: In production, create users through Supabase Auth dashboard!
