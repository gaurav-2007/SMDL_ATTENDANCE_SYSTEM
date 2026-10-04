-- ======================================================
-- SMDL College Attendance System - Migration 007
-- Purpose: Password Reset Tokens for Student & Teacher Recovery
-- ======================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ultra-fast lookup and expiry checks
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires_at ON password_reset_tokens(expires_at);
