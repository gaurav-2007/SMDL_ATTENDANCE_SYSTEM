-- ======================================================
-- SMDL College Attendance System - Migration 002
-- Purpose: Add password_hash column to users table
--   (required for custom bcrypt-based auth)
-- ======================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Optional: Index for faster email+password lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email_password_hash ON users(email, password_hash);
