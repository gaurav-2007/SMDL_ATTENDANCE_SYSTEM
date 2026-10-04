const crypto = require('crypto');
const env = require('../config/env');

// In-memory store for OTP records: email -> OTP data
const otpStore = new Map();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds
const MAX_ATTEMPTS = 5;

// Periodically purge expired entries every 15 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now && (!record.verified || (record.verifiedAt && now - record.verifiedAt > 30 * 60 * 1000))) {
      otpStore.delete(email);
    }
  }
}, 15 * 60 * 1000);

if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Generate a 6-digit cryptographic-quality numeric OTP
 */
function generateCode() {
  const randomNum = crypto.randomInt(100000, 999999);
  return randomNum.toString();
}

/**
 * Creates and stores an OTP for the given email
 * @param {string} rawEmail 
 * @param {string} role - 'student' or 'teacher'
 */
function createOtp(rawEmail, role = 'student') {
  const email = rawEmail.trim().toLowerCase();
  const now = Date.now();
  const existing = otpStore.get(email);

  // Enforce resend cooldown
  if (existing && existing.lastSentAt && (now - existing.lastSentAt < RESEND_COOLDOWN_MS)) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new OTP.`);
  }

  const code = generateCode();
  const record = {
    code,
    role,
    attempts: 0,
    expiresAt: now + OTP_EXPIRY_MS,
    lastSentAt: now,
    verified: false,
    verifiedAt: null,
    otpToken: null,
  };

  otpStore.set(email, record);

  return {
    otp: code,
    expiresAt: record.expiresAt,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
  };
}

/**
 * Validates the user-entered OTP against the stored code
 * @param {string} rawEmail 
 * @param {string} enteredCode 
 */
function verifyOtp(rawEmail, enteredCode) {
  const email = rawEmail.trim().toLowerCase();
  const record = otpStore.get(email);

  if (!record) {
    return {
      success: false,
      message: 'No OTP requested for this email or OTP expired. Please request a new code.',
    };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return {
      success: false,
      message: 'OTP has expired. Please request a new code.',
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return {
      success: false,
      message: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  const cleanEntered = (enteredCode || '').trim();
  if (record.code !== cleanEntered) {
    record.attempts += 1;
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      success: false,
      message: `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked.'}`,
    };
  }

  // Generate a tamper-proof verification token
  const otpToken = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${email}:${Date.now()}:${record.code}`)
    .digest('hex');

  record.verified = true;
  record.verifiedAt = Date.now();
  record.otpToken = otpToken;

  return {
    success: true,
    message: 'Email successfully verified.',
    otpToken,
  };
}

/**
 * Checks if the email was successfully verified within the last 30 minutes
 * @param {string} rawEmail 
 * @param {string} providedToken (optional)
 */
function isEmailVerified(rawEmail, providedToken) {
  const email = rawEmail.trim().toLowerCase();
  const record = otpStore.get(email);

  if (!record || !record.verified) {
    return false;
  }

  // Must have verified within last 30 minutes
  if (!record.verifiedAt || Date.now() - record.verifiedAt > 30 * 60 * 1000) {
    return false;
  }

  if (providedToken && record.otpToken && providedToken !== record.otpToken) {
    return false;
  }

  return true;
}

/**
 * Consumes the verification after registration completes
 */
function consumeVerification(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  otpStore.delete(email);
}

module.exports = {
  createOtp,
  verifyOtp,
  isEmailVerified,
  consumeVerification,
};
