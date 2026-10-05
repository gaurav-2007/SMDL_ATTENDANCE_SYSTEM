const rateLimit = require('express-rate-limit');

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

/**
 * 1. Global API Rate Limiter
 * Applied across all /api routes to prevent high-volume DDoS and scanning.
 * Max 300 requests per 15-minute window per IP.
 */
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many requests from this IP. Please try again in a few minutes.'),
});

/**
 * 2. Strict Authentication Rate Limiter
 * Applied to POST /api/auth/login.
 * Protects against automated brute-force and credential-stuffing dictionaries.
 * Max 10 attempts per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many login attempts. Please wait 15 minutes before trying again.'),
});

/**
 * 3. OTP Send Rate Limiter
 * Applied to POST /api/auth/send-otp.
 * Protects against SMTP quota exhaustion, spamming, and email bombing.
 * Max 5 OTP requests per 15-minute window per IP.
 */
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many OTP requests. Please wait a few minutes before requesting another OTP.'),
});

/**
 * 4. OTP Verification Rate Limiter
 * Applied to POST /api/auth/verify-otp.
 * Protects 6-digit numeric OTPs from automated guessing attacks.
 * Max 10 verification attempts per 15-minute window per IP.
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many incorrect OTP attempts. Please wait before trying again.'),
});

/**
 * 5. Password Reset Rate Limiter
 * Applied to POST /api/auth/forgot-password and POST /api/auth/reset-password.
 * Protects against automated account enumeration and recovery abuse.
 * Max 5 requests per 15-minute window per IP.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterResponse('Too many password reset requests. Please check your inbox or try again in 15 minutes.'),
});

module.exports = {
  globalApiLimiter,
  authLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
};
