const express = require('express');
const protect = require('../middleware/auth');
const {
  registerStudent,
  registerTeacher,
  login,
  getMe,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register/student', registerStudent);
router.post('/register/teacher', registerTeacher);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
