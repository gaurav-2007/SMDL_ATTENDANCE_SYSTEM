-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 20260924_create_timetable.sql
-- Module: Phase 5 - Timetable & Batch-Wise Lecture Sessions
-- =====================================================================

CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  day_of_week VARCHAR(15) NOT NULL, -- 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50) DEFAULT 'Room 101',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient batch & day lookups
CREATE INDEX IF NOT EXISTS idx_timetable_division_day ON timetable (division_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable (teacher_id);
