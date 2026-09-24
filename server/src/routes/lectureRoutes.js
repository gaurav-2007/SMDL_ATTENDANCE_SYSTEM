const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo } = require('../middleware/roles');
const {
  getActiveLectures,
  getAllLectures,
  createLecture,
  updateLectureStatus,
  deleteLecture,
  getTodaySchedule,
  getTimetableMatrix,
  getStudentTodayClasses,
} = require('../controllers/lectureController');

const router = express.Router();

router.use(protect);

router.get('/', getAllLectures);
router.get('/active', getActiveLectures);
router.get('/today', getTodaySchedule);
router.get('/today-classes', getStudentTodayClasses);
router.get('/timetable', getTimetableMatrix);
router.post('/', restrictTo('teacher', 'admin'), createLecture);
router.patch('/:id/status', restrictTo('teacher', 'admin'), updateLectureStatus);
router.delete('/:id', restrictTo('teacher', 'admin'), deleteLecture);

module.exports = router;


