-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 008_notification_system.sql
-- Module: Enterprise Notification System, Multi-Device FCM & Scheduler Deduplication
-- =====================================================================

-- 1. Extend existing notifications table
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS related_id UUID NULL,
  ADD COLUMN IF NOT EXISTS related_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Row Level Security (RLS) on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_read_own_notifications ON notifications;
CREATE POLICY user_read_own_notifications ON notifications
  FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- 2. Multi-device token store (Web & Android ready)
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(20) NOT NULL DEFAULT 'WEB', -- 'WEB', 'ANDROID', 'IOS'
  device_name VARCHAR(150) DEFAULT 'Browser',
  is_active BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_lookup ON user_devices(user_id, is_active);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_manage_own_devices ON user_devices;
CREATE POLICY user_manage_own_devices ON user_devices
  FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- 3. Atomic event-keyed lecture log (Prevents duplicate reminders, preserves legit reschedules/cancellations)
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

-- 4. Atomic low-attendance warnings (One per student per subject per calendar week)
CREATE TABLE IF NOT EXISTS low_attendance_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  warning_period_start DATE NOT NULL, -- weekly bucket: Monday date
  attendance_percentage NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, warning_period_start)
);

CREATE INDEX IF NOT EXISTS idx_low_att_lookup ON low_attendance_warnings(student_id, subject_id, warning_period_start);

-- 5. User notification category preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  announcements BOOLEAN DEFAULT TRUE,
  low_attendance BOOLEAN DEFAULT TRUE,
  lecture_reminders BOOLEAN DEFAULT TRUE,
  attendance_updates BOOLEAN DEFAULT TRUE,
  study_material BOOLEAN DEFAULT TRUE,
  security_alerts BOOLEAN DEFAULT TRUE, -- Mandatory, cannot be turned off
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_manage_own_prefs ON notification_preferences;
CREATE POLICY user_manage_own_prefs ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- 6. Dynamic System Config entries
INSERT INTO system_config (config_key, config_value, description) VALUES
('low_attendance_threshold', '75', 'Minimum required attendance percentage'),
('lecture_reminder_window_minutes', '10', 'Advance minutes to notify students prior to lecture start'),
('lecture_reminders_enabled', 'true', 'Global switch for automatic lecture reminders'),
('low_attendance_reminders_enabled', 'true', 'Global switch for low attendance warnings')
ON CONFLICT (config_key) DO NOTHING;
