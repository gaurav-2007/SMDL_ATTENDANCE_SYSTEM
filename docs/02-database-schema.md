# =============================================
# SMDL Attendance System - Database Schema
# =============================================

## Core Tables (PostgreSQL / Supabase

---

### 1. users table (Combined table with role + status
Stores all application users (students, teachers, admins)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role user_role NOT NULL DEFAULT 'student',
  status account_status NOT NULL DEFAULT 'ACTIVE',
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE account_status AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DISABLED');
```

---

### 2. students table (Extended student profile)

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_id VARCHAR(50) UNIQUE NOT NULL, -- College roll number
  course_id UUID REFERENCES courses(id),
  division_id UUID REFERENCES divisions(id),
  date_of_birth DATE,
  guardian_name VARCHAR(150),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3. teachers table (Extended teacher profile)

```sql
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  teacher_id VARCHAR(50) UNIQUE NOT NULL, -- College employee ID
  department VARCHAR(100),
  designation VARCHAR(100),
  registration_submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4. courses, classes, divisions, subjects tables

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,    -- e.g., B.Sc. CS
  code VARCHAR(20) UNIQUE NOT NULL,
  duration_years INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,      -- e.g., FY, SY, TY OR Sem 1, Sem 2
  division_name VARCHAR(10) NOT NULL, -- A, B, C
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, name, division_name)
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher-Subject Assignment
CREATE TABLE teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id)
);
```

---

### 5. lectures table (Each scheduled lecture/session)

```sql
CREATE TABLE lectures (
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
```

---

### 6. attendance table (Attendance records)

```sql
CREATE TYPE attendance_status AS ENUM (
  'PRESENT',
  'ABSENT',
  'PENDING_REVIEW',
  'TEACHER_ADDED',
  'TEACHER_MODIFIED',
  'REJECTED'
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'ABSENT',
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by UUID REFERENCES users(id),  -- Student ID of who marked it
  location_verified BOOLEAN DEFAULT FALSE,
  selfie_url TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  geofence_radius INT,
  notes TEXT,
  source VARCHAR(50), -- 'AUTO_VERIFIED', 'TEACHER_OVERRIDE'
  UNIQUE(lecture_id, student_id)
);
```

---

### 7. attendance_audit_logs table

```sql
CREATE TABLE attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES users(id) NOT NULL,
  old_status attendance_status,
  new_status attendance_status NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 8. announcements table

```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR(50) NOT NULL, -- 'COLLEGE', 'COURSE', 'DIVISION', 'SUBJECT', 'STUDENTS'
  target_id UUID,               -- Reference to the target entity
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50), -- 'PDF', 'IMAGE', 'DOCUMENT'
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 9. notifications table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 10. system_config table (For geofence, etc.)

```sql
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample config: college_geofence_latitude, college_geofence_longitude, geofence_radius_meters
```

---

## Key Indexes for Performance:

```sql
CREATE INDEX idx_attendance_lecture_student ON attendance(lecture_id, student_id);
CREATE INDEX idx_attendance_student_date ON attendance(student_id);
CREATE INDEX idx_lectures_subject_date ON lectures(subject_id, lecture_date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_announcements_target ON announcements(target_type, target_id);
```
