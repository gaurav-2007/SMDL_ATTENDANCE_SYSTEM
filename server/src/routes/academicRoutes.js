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

module.exports = router;

