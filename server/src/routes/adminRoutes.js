const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo, restrictToActiveOnly } = require('../middleware/roles');
const {
  listPendingTeachers,
  approveTeacher,
  rejectTeacher,
  listStudents,
  updateStudentStatus,
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, restrictTo('admin'), restrictToActiveOnly);

router.get('/teachers', listPendingTeachers);
router.post('/teachers/:teacher_id/approve', approveTeacher);
router.post('/teachers/:teacher_id/reject', rejectTeacher);

router.get('/students', listStudents);
router.patch('/students/:student_id/status', updateStudentStatus);

module.exports = router;
