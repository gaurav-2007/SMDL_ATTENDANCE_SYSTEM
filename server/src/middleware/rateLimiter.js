const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Standard JSON error response helper for rate limiters
 */
function createLimiterResponse(message) {
  return (req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      message,
      retryAfterSeconds: Math.ceil((options.windowMs) / 1000),
    });
  };
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * 1. Global API Rate Limiter
 * Applied across all /api routes to prevent high-volume DDoS and scanning.
 * Max 300 requests per 15-minute window per IP in production.
 */
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many requests from this IP. Please try again in a few minutes.'),
});

/**
 * 2. Strict Authentication Rate Limiter
 * Applied to POST /api/auth/login.
 * Protects against automated brute-force and credential-stuffing dictionaries.
 * Max 10 attempts per 15-minute window per IP in production.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many login attempts. Please wait 15 minutes before trying again.'),
});

/**
 * 3. OTP Send Rate Limiter
 * Applied to POST /api/auth/send-otp.
 * Protects against SMTP quota exhaustion, spamming, and email bombing.
 * Max 5 OTP requests per 15-minute window per IP in production.
 */
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many OTP requests. Please wait a few minutes before requesting another OTP.'),
});

/**
 * 4. OTP Verification Rate Limiter
 * Applied to POST /api/auth/verify-otp.
 * Protects 6-digit numeric OTPs from automated guessing attacks.
 * Max 10 verification attempts per 15-minute window per IP in production.
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many incorrect OTP attempts. Please wait before trying again.'),
});

/**
 * 5. Password Reset Rate Limiter
 * Applied to POST /api/auth/forgot-password and POST /api/auth/reset-password.
 * Protects against automated account enumeration and recovery abuse.
 * Max 5 requests per 15-minute window per IP in production.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many password reset requests. Please check your inbox or try again in 15 minutes.'),
});

/**
 * 6. Attendance Marking Rate Limiter
 * Applied to POST /api/attendance/mark.
 * Prevents automated attendance spam and burst script submission.
 * Configured per authenticated user (or IP if unauthenticated).
 */
const attendanceMarkLimiter = rateLimit({
  windowMs: env.ATTENDANCE_LIMIT_WINDOW_MS || 60 * 1000,
  max: env.ATTENDANCE_LIMIT_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? `user_${req.user.id}` : (req.ip || 'ip_unknown')),
  validate: { keyGeneratorIpFallback: false },
  handler: createLimiterResponse('Too many attendance marking attempts. Please wait a moment before trying again.'),
});

module.exports = {
  globalApiLimiter,
  authLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  attendanceMarkLimiter,
};
