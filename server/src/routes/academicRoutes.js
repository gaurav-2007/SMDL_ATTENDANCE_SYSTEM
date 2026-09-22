const express = require('express');
const protect = require('../middleware/auth');
const {
  getCourses,
  getDivisions,
  getSubjects,
  createCourse,
  createDivision,
  createSubject,
} = require('../controllers/academicController');

const router = express.Router();

router.get('/courses', getCourses);
router.post('/courses', protect, createCourse);

router.get('/divisions', getDivisions);
router.post('/divisions', protect, createDivision);

router.get('/subjects', getSubjects);
router.post('/subjects', protect, createSubject);

module.exports = router;
