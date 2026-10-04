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

const router = express.Router();

router.post('/send-otp', sendRegistrationOtp);
router.post('/verify-otp', verifyRegistrationOtp);
router.post('/register/student', registerStudent);
router.post('/register/teacher', registerTeacher);
router.post('/login', login);
router.get('/me', protect, getMe);

// Forgot Password & Reset Password Routes
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/validate', validateResetTokenController);
router.post('/reset-password', resetPasswordController);

module.exports = router;
