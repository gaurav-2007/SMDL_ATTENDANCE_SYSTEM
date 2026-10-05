const express = require('express');
const protect = require('../middleware/auth');
const {
  sendRegistrationOtp,
  verifyRegistrationOtp,
  registerStudent,
  registerTeacher,
  login,
  getMe,
  forgotPassword,
  validateResetTokenController,
  resetPasswordController,
} = require('../controllers/authController');

const {
  authLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/send-otp', otpSendLimiter, sendRegistrationOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyRegistrationOtp);
router.post('/register/student', registerStudent);
router.post('/register/teacher', registerTeacher);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);

// Forgot Password & Reset Password Routes (with rate limiting against abuse)
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.get('/reset-password/validate', validateResetTokenController);
router.post('/reset-password', passwordResetLimiter, resetPasswordController);

module.exports = router;
