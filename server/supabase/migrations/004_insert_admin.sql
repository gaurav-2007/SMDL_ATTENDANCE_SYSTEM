-- ======================================================
-- SMDL College Attendance System - Migration 004
-- Purpose: Insert DEFAULT ADMIN user + ensure teachers.updated_at col
--   Admin credentials:  admin@smdl.ac.in  /  admin@123
--   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
--   CHANGE THE DEFAULT PASSWORD AFTER FIRST LOGIN !!!
--   (bcrypt hash generated with cost 10 for "admin@123")
-- ======================================================

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE teachers SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE students SET updated_at = created_at WHERE updated_at IS NULL;

WITH new_admin AS (
  INSERT INTO users (full_name, email, password_hash, role, status, phone, created_at, updated_at)
  VALUES (
    'SMDL Admin',
    'admin@smdl.ac.in',
    '$2b$10$p5f55lfozt8vuh5z1xqTpec4qV/nTqaPChaMlfCXtSHWghpMGKEy.',
    'admin',
    'ACTIVE',
    '0000000000',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id
)
INSERT INTO teachers (user_id, teacher_id, department, registration_submitted_at, approved_at, updated_at)
SELECT
  (SELECT id FROM new_admin),
  'ADMIN-0001',
  'Administration',
  NOW(),
  NOW(),
  NOW()
WHERE EXISTS (SELECT 1 FROM new_admin);
