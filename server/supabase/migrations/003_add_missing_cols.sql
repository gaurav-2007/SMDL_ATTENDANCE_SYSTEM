-- ======================================================
-- SMDL College Attendance System - Migration 003
-- Purpose: Add missing audit & convenience columns
--   that backend uses but were missing in 001
-- ======================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill updated_at where NULL (use created_at)
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
