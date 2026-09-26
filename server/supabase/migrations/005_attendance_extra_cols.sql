-- =============================================
-- Migration 005: Add extra columns to attendance table
-- Run this in Supabase SQL Editor
-- =============================================

-- Add teacher_override column (was missing)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS teacher_override BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add previous_status to audit_logs (controller uses this column name)
ALTER TABLE attendance_audit_logs ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- Optional: rename old_status to match controller code if exists (safe with IF EXISTS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='attendance_audit_logs' AND column_name='old_status'
  ) THEN
    ALTER TABLE attendance_audit_logs RENAME COLUMN old_status TO old_status_enum;
  END IF;
END $$;

SELECT 'Migration 005 complete!' as result;
