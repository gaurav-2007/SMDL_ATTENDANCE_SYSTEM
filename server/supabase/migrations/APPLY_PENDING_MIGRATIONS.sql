-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- COMBINED PENDING MIGRATIONS (007 & 008)
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/sxdaghnxmypmwyobhuds/sql/new
-- =====================================================================

-- =====================================================================
-- PART 1: MIGRATION 007 — TIMETABLE & DIVISION SCHEDULES
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
-- PART 2: MIGRATION 008 — NOTIFICATIONS, TOKENS & DEDUPLICATION
-- =====================================================================

-- 4. Extend notifications table
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS related_id UUID NULL,
  ADD COLUMN IF NOT EXISTS related_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- 5. Multi-device push token storage
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(20) NOT NULL DEFAULT 'WEB',
  device_name VARCHAR(150) DEFAULT 'Browser',
  is_active BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_lookup ON user_devices(user_id, is_active);

-- 6. User Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  announcements BOOLEAN DEFAULT TRUE,
  low_attendance BOOLEAN DEFAULT TRUE,
  lecture_reminders BOOLEAN DEFAULT TRUE,
  attendance_updates BOOLEAN DEFAULT TRUE,
  study_material BOOLEAN DEFAULT TRUE,
  security_alerts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

-- 7. Low Attendance Warnings Deduplication
CREATE TABLE IF NOT EXISTS low_attendance_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  warning_period_start DATE NOT NULL,
  attendance_percentage NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, warning_period_start)
);

CREATE INDEX IF NOT EXISTS idx_low_att_lookup ON low_attendance_warnings(student_id, subject_id, warning_period_start);

-- 8. Atomic Event-Keyed Lecture Reminder Logs
CREATE TABLE IF NOT EXISTS lecture_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key VARCHAR(120) UNIQUE NOT NULL,
  lecture_id UUID NOT NULL,
  lecture_date DATE NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  target_division_id UUID NOT NULL,
  scheduled_start_time TIME NOT NULL,
  student_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecture_logs_key ON lecture_notification_logs(event_key);

-- 9. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires_at ON password_reset_tokens(expires_at);

-- 10. Email Verification OTP Store
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  is_verified BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  otp_token VARCHAR(255),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(otp_token);

-- 11. System Config defaults
INSERT INTO system_config (config_key, config_value, description) VALUES
  ('low_attendance_threshold', '75', 'Minimum required attendance percentage'),
  ('lecture_reminder_window_minutes', '10', 'Advance minutes to notify students prior to lecture start'),
  ('lecture_reminders_enabled', 'true', 'Global switch for automatic lecture reminders'),
  ('low_attendance_reminders_enabled', 'true', 'Global switch for low attendance warnings')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================================
-- PART 3: ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- =====================================================================

ALTER TABLE division_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_attendance_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- 1. division_timetables
DROP POLICY IF EXISTS "Allow authenticated read timetable" ON division_timetables;
CREATE POLICY "Allow authenticated read timetable" ON division_timetables
  FOR SELECT TO authenticated USING (true);

-- 2. timetable
DROP POLICY IF EXISTS "Allow read timetable general" ON timetable;
CREATE POLICY "Allow read timetable general" ON timetable
  FOR SELECT TO authenticated USING (true);

-- 3. attendance_records
DROP POLICY IF EXISTS "Allow read attendance records" ON attendance_records;
CREATE POLICY "Allow read attendance records" ON attendance_records
  FOR SELECT TO authenticated USING (true);

-- 4. notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. user_devices
DROP POLICY IF EXISTS "Users manage own devices" ON user_devices;
CREATE POLICY "Users manage own devices" ON user_devices
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6. notification_preferences
DROP POLICY IF EXISTS "Users manage own preferences" ON notification_preferences;
CREATE POLICY "Users manage own preferences" ON notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Universal backend access: service_role bypasses RLS and has full administrative permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT ON TABLE division_timetables TO authenticated, anon;
GRANT SELECT ON TABLE timetable TO authenticated, anon;
GRANT SELECT ON TABLE attendance_records TO authenticated;
GRANT SELECT, UPDATE ON TABLE notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE notification_preferences TO authenticated;

-- Verify migration success
SELECT 
  table_name, 
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN (
    'division_timetables', 
    'timetable', 
    'attendance_records', 
    'user_devices', 
    'notification_preferences', 
    'low_attendance_warnings', 
    'lecture_notification_logs', 
    'password_reset_tokens', 
    'email_verifications'
  )
ORDER BY table_name;
