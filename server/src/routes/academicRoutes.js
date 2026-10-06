const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo, restrictToActiveOnly } = require('../middleware/roles');
const {
  getCourses,
  getDivisions,
  getSubjects,
  createCourse,
  createDivision,
  createSubject,
  batchCreateSubjects,
  deleteSubject,
  deleteDivision,
  deleteCourse,
  getDivisionTimetable,
  saveTimetableSlot,
  deleteTimetableSlot,
  loadSmdlTimetableMatrix,
  getTeachersList,
} = require('../controllers/academicController');

const router = express.Router();

// Public / Read access (used by student/teacher registration, student dashboards, etc.)
router.get('/courses', getCourses);
router.get('/divisions', getDivisions);
router.get('/subjects', getSubjects);

// Protected Read access (active users can view timetables and teacher assignments)
router.get('/teachers-list', protect, restrictToActiveOnly, getTeachersList);
router.get('/timetable/:division_id', protect, restrictToActiveOnly, getDivisionTimetable);

// Administrative Academic Management (STRICTLY ADMIN ONLY)
router.post('/courses', protect, restrictTo('admin'), restrictToActiveOnly, createCourse);
router.delete('/courses/:id', protect, restrictTo('admin'), restrictToActiveOnly, deleteCourse);

router.post('/divisions', protect, restrictTo('admin'), restrictToActiveOnly, createDivision);
router.delete('/divisions/:id', protect, restrictTo('admin'), restrictToActiveOnly, deleteDivision);

router.post('/subjects', protect, restrictTo('admin'), restrictToActiveOnly, createSubject);
router.post('/subjects/batch', protect, restrictTo('admin'), restrictToActiveOnly, batchCreateSubjects);
router.delete('/subjects/:id', protect, restrictTo('admin'), restrictToActiveOnly, deleteSubject);

// Timetable Management (STRICTLY ADMIN ONLY)
router.post('/timetable', protect, restrictTo('admin'), restrictToActiveOnly, saveTimetableSlot);
router.delete('/timetable/:id', protect, restrictTo('admin'), restrictToActiveOnly, deleteTimetableSlot);
router.post('/timetable/load-smdl-matrix', protect, restrictTo('admin'), restrictToActiveOnly, loadSmdlTimetableMatrix);

module.exports = router;


