const crypto = require('crypto');
const { supabaseAdmin } = require('../config/db');
const env = require('../config/env');
const { hashPassword } = require('../utils/password');
const {
  sendPasswordResetEmail,
  sendPasswordChangedSecurityEmail,
} = require('./emailService');

// In-memory fallback and fast-lookup token store
// key: tokenHash -> { userId, email, role, expiresAt, used }
const tokenStore = new Map();

// Rate limiter store: key (email/ip) -> array of timestamps
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 3;
const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// Periodic cleanup of expired tokens every 15 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [hash, record] of tokenStore.entries()) {
    if (record.expiresAt < now || record.used) {
      tokenStore.delete(hash);
    }
  }
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, recent);
    }
  }
}, 15 * 60 * 1000);

if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Check rate limit for an identifier
 */
function isRateLimited(identifier) {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const history = rateLimitStore.get(key) || [];
  const recent = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  recent.push(now);
  rateLimitStore.set(key, recent);
  return false;
}

/**
 * Hash raw token with SHA-256
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Request a password reset link
 * Always returns a generic success message to prevent email enumeration.
 * @param {string} rawEmail 
 * @param {string} clientIp 
 */
async function requestPasswordReset(rawEmail, clientIp = '') {
  const email = (rawEmail || '').trim().toLowerCase();
  const genericMessage = 'If an account exists for this email, a password reset link has been sent. Please check your inbox.';

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: true, message: genericMessage };
  }

  // Rate limit protection
  const rateLimitKey = `${clientIp}_${email}`;
  if (isRateLimited(rateLimitKey)) {
    console.warn(`[passwordResetService] Throttled password reset request for: ${email}`);
    return { success: true, message: genericMessage };
  }

  try {
    // 1. Find user by email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, status')
      .ilike('email', email)
      .maybeSingle();

    // 2. Only allow student and teacher roles
    if (!user || (user.role !== 'student' && user.role !== 'teacher')) {
      return { success: true, message: genericMessage };
    }

    // 3. Generate cryptographically secure random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenH = hashToken(rawToken);
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

    // 4. Invalidate any previous in-memory tokens for this user
    for (const [hash, record] of tokenStore.entries()) {
      if (record.userId === user.id) {
        tokenStore.delete(hash);
      }
    }

    // Store in in-memory map
    tokenStore.set(tokenH, {
      userId: user.id,
      email: user.email,
      role: user.role,
      expiresAt,
      used: false,
      rawToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
    });

    // 5. Attempt to persist in Supabase if table exists
    try {
      await supabaseAdmin.from('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: tokenH,
        expires_at: new Date(expiresAt).toISOString(),
        used: false,
      });
    } catch (_dbErr) {
      // Graceful fallback to tokenStore
    }

    // 6. Build secure reset URL
    const clientBaseUrl = (env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const resetUrl = `${clientBaseUrl}/reset-password?token=${rawToken}`;

    // 7. Send branded HTML password reset email
    await sendPasswordResetEmail(user.email, resetUrl, user.role);

    // 8. Create in-app security notification
    try {
      const { createNotification } = require('./notificationService');
      await createNotification({
        userId: user.id,
        type: 'PASSWORD_RESET',
        title: 'Password Reset Requested',
        message: 'A password reset link was requested for your account. If this was not you, please contact the administrator.',
        relatedType: 'security',
        metadata: { client_ip: clientIp },
      });
    } catch (_nErr) {}

    return {
      success: true,
      message: genericMessage,
      ...(process.env.NODE_ENV !== 'production' ? { dev_token: rawToken } : {}),
    };
  } catch (error) {
    console.error('[passwordResetService] Error processing reset request:', error.message);
    return { success: true, message: genericMessage };
  }
}

/**
 * Validate a password reset token
 * @param {string} rawToken 
 */
async function validateResetToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, message: 'This password reset link is invalid or has expired.' };
  }

  const tokenH = hashToken(rawToken.trim());
  const now = Date.now();

  // 1. Check in-memory token store first
  const memoryRecord = tokenStore.get(tokenH);
  if (memoryRecord) {
    if (memoryRecord.used) {
      return { valid: false, message: 'This password reset link has already been used.' };
    }
    if (now > memoryRecord.expiresAt) {
      tokenStore.delete(tokenH);
      return { valid: false, message: 'This password reset link has expired.' };
    }
    return { valid: true, email: memoryRecord.email, role: memoryRecord.role };
  }

  // 2. Check Supabase table
  try {
    const { data: dbRecord } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used, users(id, email, role)')
      .eq('token_hash', tokenH)
      .maybeSingle();

    if (dbRecord) {
      if (dbRecord.used) {
        return { valid: false, message: 'This password reset link has already been used.' };
      }
      if (new Date(dbRecord.expires_at).getTime() < now) {
        return { valid: false, message: 'This password reset link has expired.' };
      }

      // Sync into memory for fast execution
      tokenStore.set(tokenH, {
        userId: dbRecord.user_id,
        email: dbRecord.users?.email,
        role: dbRecord.users?.role,
        expiresAt: new Date(dbRecord.expires_at).getTime(),
        used: false,
      });

      return { valid: true, email: dbRecord.users?.email, role: dbRecord.users?.role };
    }
  } catch (_e) {
    // Ignore db read error
  }

  return { valid: false, message: 'This password reset link is invalid or has expired.' };
}

/**
 * Execute password reset with validated token and new password
 * @param {string} rawToken 
 * @param {string} newPassword 
 */
async function executePasswordReset(rawToken, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const validation = await validateResetToken(rawToken);
  if (!validation.valid) {
    throw new Error(validation.message || 'This password reset link is invalid or has expired.');
  }

  const tokenH = hashToken(rawToken.trim());
  const memoryRecord = tokenStore.get(tokenH);

  let userId = memoryRecord?.userId;
  let userEmail = memoryRecord?.email;
  let userRole = memoryRecord?.role;

  if (!userId) {
    // Lookup via DB
    const { data: dbRec } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('user_id, users(id, email, role)')
      .eq('token_hash', tokenH)
      .maybeSingle();

    if (!dbRec) {
      throw new Error('Invalid recovery session.');
    }
    userId = dbRec.user_id;
    userEmail = dbRec.users?.email;
    userRole = dbRec.users?.role;
  }

  // Hash new password using bcrypt
  const passwordHash = await hashPassword(newPassword);

  // Update password in users table without changing role or account_status
  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateErr) {
    console.error('[passwordResetService] Failed to update password:', updateErr);
    throw new Error('Failed to update password. Please try again.');
  }

  // Mark token as used
  if (memoryRecord) {
    memoryRecord.used = true;
    memoryRecord.usedAt = Date.now();
  }

  try {
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('token_hash', tokenH);
  } catch (_e) {
    // Table may not exist yet
  }

  // Invalidate any other tokens for this user
  for (const [hash, record] of tokenStore.entries()) {
    if (record.userId === userId) {
      tokenStore.delete(hash);
    }
  }

  // Create security notification in notifications table
  try {
    const { createNotification } = require('./notificationService');
    await createNotification({
      userId,
      type: 'PASSWORD_CHANGED',
      title: 'Password Changed',
      message: 'Your SMDL account password was successfully changed.',
      relatedType: 'security',
    });
  } catch (notifErr) {
    console.warn('[passwordResetService] Security notification warning:', notifErr.message);
  }

  // Send security alert email to user
  if (userEmail) {
    sendPasswordChangedSecurityEmail(userEmail, userRole).catch(() => {});
  }

  return {
    success: true,
    message: 'Your password has been changed successfully. You can now log in with your new password.',
  };
}

module.exports = {
  requestPasswordReset,
  validateResetToken,
  executePasswordReset,
  _tokenStore: tokenStore,
  _hashToken: hashToken,
};
