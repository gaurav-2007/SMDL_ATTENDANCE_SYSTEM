-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 20260925_simplified_admin_schema.sql
-- Simplified, Corrected Plan for Small College Scale
-- =====================================================================

-- 1. Division Timetable: one row per lecture slot, per division, per week
CREATE TABLE IF NOT EXISTS division_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  day_of_week VARCHAR(10) NOT NULL, -- 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  room_number VARCHAR(50) DEFAULT 'Room 101',
  is_lab BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(division_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_division_timetables_lookup 
  ON division_timetables (division_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_division_timetables_teacher 
  ON division_timetables (teacher_id, day_of_week, start_time);

-- 2. Attendance Records: one row per student per lecture slot per calendar date
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID REFERENCES division_timetables(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESENT', -- 'PRESENT' / 'ABSENT'
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  selfie_url TEXT,
  verification_method VARCHAR(20) DEFAULT 'self', -- 'self' / 'teacher_override'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(timetable_id, attendance_date, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_lookup 
  ON attendance_records (timetable_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student 
  ON attendance_records (student_id, attendance_date);

-- 3. Attendance Audit Log: tracks teacher & admin manual overrides
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  old_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Table 1: attendance_audit_logs RLS
ALTER TABLE attendance_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_only_audit ON attendance_audit_logs;
CREATE POLICY admin_only_audit ON attendance_audit_logs 
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- No UPDATE or DELETE policy on attendance_audit_logs -> Immutable audit trail!

-- Table 2: division_timetables RLS
ALTER TABLE division_timetables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS read_own_division ON division_timetables;
CREATE POLICY read_own_division ON division_timetables 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students 
      WHERE students.user_id = auth.uid() 
        AND students.division_id = division_timetables.division_id
    )
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('teacher', 'admin')
    )
  );

DROP POLICY IF EXISTS admin_write_timetable ON division_timetables;
CREATE POLICY admin_write_timetable ON division_timetables 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS admin_update_timetable ON division_timetables;
CREATE POLICY admin_update_timetable ON division_timetables 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS admin_delete_timetable ON division_timetables;
CREATE POLICY admin_delete_timetable ON division_timetables 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );
