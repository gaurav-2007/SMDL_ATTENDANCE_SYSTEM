-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 007_timetable_and_divisions.sql
-- Module: Timetable Management, Division Schedules & Timetable Persistence
-- =====================================================================

-- 1. Division Timetable: one row per lecture slot, per division, per week
CREATE TABLE IF NOT EXISTS division_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  day_of_week VARCHAR(20) NOT NULL, -- 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
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

-- 2. General Timetable table (for backward compatibility)
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50) DEFAULT 'Room 101',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetable_division_day ON timetable (division_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable (teacher_id);

-- 3. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID REFERENCES division_timetables(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  selfie_url TEXT,
  verification_method VARCHAR(30) DEFAULT 'self',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(timetable_id, attendance_date, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_lookup 
  ON attendance_records (timetable_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student 
  ON attendance_records (student_id, attendance_date);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE division_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read timetable" ON division_timetables;
CREATE POLICY "Allow authenticated read timetable" ON division_timetables
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read timetable general" ON timetable;
CREATE POLICY "Allow read timetable general" ON timetable
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read attendance records" ON attendance_records;
CREATE POLICY "Allow read attendance records" ON attendance_records
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON TABLE division_timetables TO service_role;
GRANT SELECT ON TABLE division_timetables TO authenticated, anon;

GRANT ALL ON TABLE timetable TO service_role;
GRANT SELECT ON TABLE timetable TO authenticated, anon;

GRANT ALL ON TABLE attendance_records TO service_role;
GRANT SELECT ON TABLE attendance_records TO authenticated;
