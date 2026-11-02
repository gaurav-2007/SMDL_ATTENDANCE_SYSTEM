const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo, restrictToActiveOnly } = require('../middleware/roles');
const {
  getActiveLectures,
  getAllLectures,
  createLecture,
  updateLecture,
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
router.post('/', restrictTo('teacher', 'admin'), restrictToActiveOnly, createLecture);
router.patch('/:id/status', restrictTo('teacher', 'admin'), restrictToActiveOnly, updateLectureStatus);
router.put('/:id', restrictTo('teacher', 'admin'), restrictToActiveOnly, updateLecture);
router.delete('/:id', restrictTo('teacher', 'admin'), restrictToActiveOnly, deleteLecture);

module.exports = router;


