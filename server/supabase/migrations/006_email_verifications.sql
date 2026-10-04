-- ======================================================
-- SMDL College Attendance System - Migration 006
-- Purpose: Add email verification logging / persistence
-- ======================================================

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  is_verified BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy email queries and expiry checks
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Optional: Add email_verified boolean flag on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL;
