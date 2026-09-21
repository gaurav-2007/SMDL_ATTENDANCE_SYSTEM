const express = require('express');
const protect = require('../middleware/auth');
const {
  getCourses,
  getDivisions,
  getSubjects,
} = require('../controllers/academicController');

const router = express.Router();

router.get('/courses', getCourses);
router.get('/divisions', getDivisions);
router.get('/subjects', getSubjects);

module.exports = router;
