const express = require('express');
const protect = require('../middleware/auth');
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

router.get('/courses', getCourses);
router.post('/courses', protect, createCourse);
router.delete('/courses/:id', protect, deleteCourse);

router.get('/divisions', getDivisions);
router.post('/divisions', protect, createDivision);
router.delete('/divisions/:id', protect, deleteDivision);

router.get('/subjects', getSubjects);
router.post('/subjects', protect, createSubject);
router.post('/subjects/batch', protect, batchCreateSubjects);
router.delete('/subjects/:id', protect, deleteSubject);

// Timetable endpoints (Fix #2 Double-Booking checked in saveTimetableSlot)
router.get('/teachers-list', protect, getTeachersList);
router.get('/timetable/:division_id', protect, getDivisionTimetable);
router.post('/timetable', protect, saveTimetableSlot);
router.delete('/timetable/:id', protect, deleteTimetableSlot);
router.post('/timetable/load-smdl-matrix', protect, loadSmdlTimetableMatrix);

module.exports = router;


