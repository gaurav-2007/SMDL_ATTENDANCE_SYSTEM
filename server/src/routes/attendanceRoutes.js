const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo, restrictToActiveOnly } = require('../middleware/roles');
const {
  markAttendance,
  getLectureAttendance,
  overrideAttendance,
  getMyStats,
  getReportsOverview,
} = require('../controllers/attendanceController');

const router = express.Router();

router.use(protect);

router.post('/mark', restrictTo('student', 'admin'), markAttendance);
router.get('/my-stats', restrictTo('student', 'admin'), getMyStats);
router.get('/lecture/:lectureId', restrictTo('teacher', 'admin'), restrictToActiveOnly, getLectureAttendance);
router.post('/override', restrictTo('teacher', 'admin'), restrictToActiveOnly, overrideAttendance);
router.get('/reports/overview', restrictTo('teacher', 'admin'), restrictToActiveOnly, getReportsOverview);

module.exports = router;
