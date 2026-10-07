-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 010_attendance_selfie_storage.sql
-- Module: Production Attendance Selfie Storage & 48-Hour Retention Policy
-- =====================================================================

-- 1. Add storage reference and expiration tracking columns to attendance
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS selfie_storage_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS selfie_uploaded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS selfie_expires_at TIMESTAMPTZ NULL;

-- 2. Performance index for periodic 48-hour retention cleanup
CREATE INDEX IF NOT EXISTS idx_attendance_selfie_cleanup 
  ON attendance (selfie_expires_at) 
  WHERE selfie_storage_path IS NOT NULL;

-- 3. Reversibility / Rollback Guide:
-- ALTER TABLE attendance DROP COLUMN IF EXISTS selfie_storage_path;
-- ALTER TABLE attendance DROP COLUMN IF EXISTS selfie_uploaded_at;
-- ALTER TABLE attendance DROP COLUMN IF EXISTS selfie_expires_at;
-- DROP INDEX IF EXISTS idx_attendance_selfie_cleanup;
