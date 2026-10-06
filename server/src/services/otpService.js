const crypto = require('crypto');
const { supabaseAdmin } = require('../config/db');
const env = require('../config/env');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds
const MAX_ATTEMPTS = 5;
const VERIFICATION_VALIDITY_MS = 30 * 60 * 1000; // 30 minutes validity to complete registration

// Environment gating: development-only flag
const isDev = (process.env.NODE_ENV === 'development');

// Ephemeral in-memory store EXCLUSIVELY for local development when DB migrations are pending
// STRICTLY prohibited from initializing or operating in staging or production environments
const devFallbackStore = isDev ? new Map() : null;
let isTableMissingWarningLogged = false;

function isTableMissingError(err) {
  if (!err) return false;
  return err.code === 'PGRST205' || err.code === '42P01' || (err.message && err.message.includes('schema cache'));
}

function warnTableMissingOnce() {
  if (!isTableMissingWarningLogged && isDev) {
    isTableMissingWarningLogged = true;
    console.warn(
      '⚠️ [otpService][DEV ONLY] Table "public.email_verifications" not found in Supabase schema cache. Operating in development fallback. Run migration 006_email_verifications.sql in Supabase SQL editor.'
    );
  }
}

/**
 * Generate a 6-digit cryptographic-quality numeric OTP
 */
function generateCode() {
  const randomNum = crypto.randomInt(100000, 1000000);
  return randomNum.toString();
}

/**
 * Creates and stores an OTP for the given email in email_verifications table.
 * In production, PostgreSQL/Supabase email_verifications is the SOLE source of truth.
 * @param {string} rawEmail 
 * @param {string} role - 'student' or 'teacher'
 */
async function createOtp(rawEmail, role = 'student') {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error('Valid email address is required.');
  }

  const now = Date.now();

  // 1. Check resend cooldown in PostgreSQL database
  try {
    const { data: recent, error: cooldownErr } = await supabaseAdmin
      .from('email_verifications')
      .select('id, created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cooldownErr) {
      if (!isDev || !isTableMissingError(cooldownErr)) {
        throw new Error('Verification service temporarily unavailable. Please try again later.');
      }
    } else if (recent?.created_at) {
      const elapsed = now - new Date(recent.created_at).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new OTP.`);
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('Please wait')) {
      throw err;
    }
    if (!isDev) {
      throw new Error('Verification service temporarily unavailable. Please try again later.');
    }
  }

  // Development-only cooldown check
  if (isDev && devFallbackStore) {
    const memExisting = devFallbackStore.get(email);
    if (memExisting && memExisting.lastSentAt && now - memExisting.lastSentAt < RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - memExisting.lastSentAt)) / 1000);
      throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new OTP.`);
    }
  }

  const code = generateCode();
  const expiresAt = new Date(now + OTP_EXPIRY_MS).toISOString();
  let dbPersisted = false;

  // 2. Persist OTP in PostgreSQL/Supabase email_verifications table
  try {
    // Invalidate previous unverified OTPs for this email
    await supabaseAdmin
      .from('email_verifications')
      .update({ is_verified: true, consumed_at: new Date().toISOString() })
      .eq('email', email)
      .eq('is_verified', false);

    const { data: record, error: insErr } = await supabaseAdmin
      .from('email_verifications')
      .insert({
        email,
        otp_code: code,
        role,
        is_verified: false,
        attempts: 0,
        expires_at: expiresAt,
      })
      .select('id, email, expires_at')
      .single();

    if (!insErr && record) {
      dbPersisted = true;
    } else {
      if (!isDev) {
        throw new Error('Failed to persist verification code. Verification service temporarily unavailable.');
      }
      if (isTableMissingError(insErr)) {
        warnTableMissingOnce();
      }
    }
  } catch (dbErr) {
    if (!isDev) {
      throw new Error('Verification service temporarily unavailable. Please try again later.');
    }
    if (isTableMissingError(dbErr)) {
      warnTableMissingOnce();
    }
  }

  // 3. In non-development (production/staging), if DB persistence failed, abort safely
  if (!isDev && !dbPersisted) {
    throw new Error('Verification service temporarily unavailable. Please try again later.');
  }

  // 4. In development only, record in devFallbackStore if DB table is missing
  if (isDev && devFallbackStore) {
    devFallbackStore.set(email, {
      code,
      role,
      attempts: 0,
      expiresAt: now + OTP_EXPIRY_MS,
      lastSentAt: now,
      verified: false,
      verifiedAt: null,
      otpToken: null,
    });
    console.log(`🔑 [DEV ONLY] OTP for ${email}: ${code}`);
  }

  return {
    otp: code,
    expiresAt: now + OTP_EXPIRY_MS,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    persisted: dbPersisted,
  };
}

/**
 * Validates user-entered OTP against the database record.
 * In production, PostgreSQL/Supabase email_verifications is the SOLE source of truth.
 * @param {string} rawEmail 
 * @param {string} enteredCode 
 */
async function verifyOtp(rawEmail, enteredCode) {
  const email = (rawEmail || '').trim().toLowerCase();
  const cleanEntered = (enteredCode || '').trim();
  const now = Date.now();

  if (!cleanEntered || cleanEntered.length !== 6) {
    return {
      success: false,
      valid: false,
      reason: 'INVALID_FORMAT',
      message: 'Please enter a valid 6-digit verification code.',
    };
  }

  // 1. Primary & Sole Source of Truth: PostgreSQL email_verifications table
  try {
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      if (!isDev) {
        return {
          success: false,
          valid: false,
          reason: 'SERVICE_UNAVAILABLE',
          message: 'Verification service temporarily unavailable. Please try again later.',
        };
      }
      if (isTableMissingError(fetchErr)) {
        warnTableMissingOnce();
      }
    } else if (record) {
      // Check expiry (10 minutes)
      if (new Date(record.expires_at).getTime() < now) {
        return {
          success: false,
          valid: false,
          reason: 'EXPIRED',
          message: 'OTP has expired. Please request a new code.',
        };
      }

      // Check max attempts (5 attempts)
      if ((record.attempts || 0) >= MAX_ATTEMPTS) {
        return {
          success: false,
          valid: false,
          reason: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Too many incorrect attempts. This code is locked. Please request a new OTP.',
        };
      }

      // Check code match
      if (record.otp_code !== cleanEntered) {
        const nextAttempts = (record.attempts || 0) + 1;
        await supabaseAdmin
          .from('email_verifications')
          .update({ attempts: nextAttempts })
          .eq('id', record.id);

        const remaining = MAX_ATTEMPTS - nextAttempts;
        return {
          success: false,
          valid: false,
          reason: remaining <= 0 ? 'MAX_ATTEMPTS_EXCEEDED' : 'INVALID_CODE',
          message: `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please request a new OTP.'}`,
        };
      }

      // Code matches! Generate signed tamper-proof verification token
      const verifiedAt = new Date().toISOString();
      const signature = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(`${record.id}:${email}:${verifiedAt}`)
        .digest('hex');
      const otpToken = `${record.id}.${now}.${signature}`;

      // Single-use: mark as verified in PostgreSQL
      await supabaseAdmin
        .from('email_verifications')
        .update({
          is_verified: true,
          verified_at: verifiedAt,
          otp_token: otpToken,
        })
        .eq('id', record.id);

      return {
        success: true,
        valid: true,
        message: 'Email address verified successfully.',
        otpToken,
        token: otpToken,
      };
    } else if (!isDev) {
      // In production, record was not found or already verified
      return {
        success: false,
        valid: false,
        reason: 'NOT_FOUND',
        message: 'No pending verification found or OTP has already been used. Please request a new code.',
      };
    }
  } catch (err) {
    if (!isDev) {
      return {
        success: false,
        valid: false,
        reason: 'SERVICE_UNAVAILABLE',
        message: 'Verification service temporarily unavailable. Please try again later.',
      };
    }
  }

  // 2. Local development fallback (EXCLUSIVELY for NODE_ENV=development)
  if (!isDev || !devFallbackStore) {
    return {
      success: false,
      valid: false,
      reason: 'NOT_FOUND',
      message: 'No pending verification found or OTP has already been used. Please request a new code.',
    };
  }

  const memRecord = devFallbackStore.get(email);
  if (!memRecord) {
    return {
      success: false,
      valid: false,
      reason: 'NOT_FOUND',
      message: 'No OTP requested for this email or OTP expired. Please request a new code.',
    };
  }

  if (memRecord.verified || memRecord.consumed) {
    return {
      success: false,
      valid: false,
      reason: 'ALREADY_USED',
      message: 'This OTP has already been verified and cannot be reused.',
    };
  }

  if (now > memRecord.expiresAt) {
    devFallbackStore.delete(email);
    return {
      success: false,
      valid: false,
      reason: 'EXPIRED',
      message: 'OTP has expired. Please request a new code.',
    };
  }

  if (memRecord.attempts >= MAX_ATTEMPTS) {
    devFallbackStore.delete(email);
    return {
      success: false,
      valid: false,
      reason: 'MAX_ATTEMPTS_EXCEEDED',
      message: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  if (memRecord.code !== cleanEntered) {
    memRecord.attempts += 1;
    const remaining = MAX_ATTEMPTS - memRecord.attempts;
    return {
      success: false,
      valid: false,
      reason: remaining <= 0 ? 'MAX_ATTEMPTS_EXCEEDED' : 'INVALID_CODE',
      message: `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked.'}`,
    };
  }

  const memVerifiedAt = Date.now();
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`mem:${email}:${memVerifiedAt}:${memRecord.code}`)
    .digest('hex');
  const otpToken = `mem.${memVerifiedAt}.${signature}`;

  memRecord.verified = true;
  memRecord.verifiedAt = memVerifiedAt;
  memRecord.otpToken = otpToken;

  return {
    success: true,
    valid: true,
    message: 'Email successfully verified.',
    otpToken,
    token: otpToken,
  };
}

/**
 * Checks if the email was successfully verified within the last 30 minutes.
 * @param {string} rawEmail 
 * @param {string} providedToken 
 */
async function isEmailVerified(rawEmail, providedToken) {
  const email = (rawEmail || '').trim().toLowerCase();
  const now = Date.now();

  // 1. Check via token if token format is id.timestamp.signature
  if (providedToken && typeof providedToken === 'string') {
    const parts = providedToken.split('.');
    if (parts.length === 3) {
      const [recordId, timestampStr, providedSig] = parts;
      const tokenTime = parseInt(timestampStr, 10);

      // Verify token age: must be <= 30 minutes old
      if (!isNaN(tokenTime) && now - tokenTime <= VERIFICATION_VALIDITY_MS) {
        if (recordId !== 'mem') {
          // Verify against PostgreSQL database table
          try {
            const { data: record } = await supabaseAdmin
              .from('email_verifications')
              .select('*')
              .eq('id', recordId)
              .eq('email', email)
              .eq('is_verified', true)
              .maybeSingle();

            if (record && record.verified_at) {
              const expectedSig = crypto
                .createHmac('sha256', env.JWT_SECRET)
                .update(`${record.id}:${email}:${record.verified_at}`)
                .digest('hex');

              if (expectedSig === providedSig) {
                const isConsumed = record.consumed_at != null;
                const withinWindow = now - new Date(record.verified_at).getTime() <= VERIFICATION_VALIDITY_MS;
                if (!isConsumed && withinWindow) {
                  return true;
                }
              }
            }
          } catch (_e) {}
        } else if (isDev && devFallbackStore) {
          // Development-only token verification
          const mem = devFallbackStore.get(email);
          if (mem && mem.verified && mem.otpToken === providedToken && !mem.consumed) {
            if (now - (mem.verifiedAt || 0) <= VERIFICATION_VALIDITY_MS) {
              return true;
            }
          }
        }
      }
    }
  }

  // 2. Direct database query check for active verified status
  try {
    const { data: activeVerified } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('is_verified', true)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeVerified && activeVerified.verified_at && !activeVerified.consumed_at) {
      const elapsed = now - new Date(activeVerified.verified_at).getTime();
      if (elapsed <= VERIFICATION_VALIDITY_MS) {
        return true;
      }
    }
  } catch (_e) {}

  // 3. Development-only fallback check
  if (isDev && devFallbackStore) {
    const mem = devFallbackStore.get(email);
    if (mem && mem.verified && mem.verifiedAt && !mem.consumed) {
      if (now - mem.verifiedAt <= VERIFICATION_VALIDITY_MS) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Consumes the verification after registration completes to prevent reuse.
 * @param {string} rawEmail 
 */
async function consumeVerification(rawEmail) {
  const email = (rawEmail || '').trim().toLowerCase();
  const now = new Date().toISOString();

  // Invalidate in PostgreSQL database
  try {
    await supabaseAdmin
      .from('email_verifications')
      .update({
        is_verified: false,
        consumed_at: now,
      })
      .eq('email', email)
      .eq('is_verified', true);
  } catch (_e) {}

  // Invalidate in development fallback
  if (isDev && devFallbackStore) {
    const mem = devFallbackStore.get(email);
    if (mem) {
      mem.consumed = true;
      mem.consumedAt = Date.now();
    }
    devFallbackStore.delete(email);
  }
}

module.exports = {
  createOtp,
  verifyOtp,
  isEmailVerified,
  consumeVerification,
  getDevFallbackStore: () => devFallbackStore,
  getInMemoryStore: () => devFallbackStore,
};
