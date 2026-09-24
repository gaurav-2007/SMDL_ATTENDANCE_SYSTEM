const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo, restrictToActiveOnly } = require('../middleware/roles');
const {
  listPendingTeachers,
  approveTeacher,
  rejectTeacher,
  suspendTeacher,
  disableTeacher,
  listStudents,
  updateStudentStatus,
  bulkImportStudents,
  transferStudentDivision,
  getLiveAttendanceSummary,
  getAttendanceAuditLogs,
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, restrictTo('admin'), restrictToActiveOnly);

router.get('/teachers', listPendingTeachers);
router.post('/teachers/:teacher_id/approve', approveTeacher);
router.post('/teachers/:teacher_id/reject', rejectTeacher);
router.post('/teachers/:teacher_id/suspend', suspendTeacher);
router.post('/teachers/:teacher_id/disable', disableTeacher);

router.get('/students', listStudents);
router.patch('/students/:student_id/status', updateStudentStatus);
router.post('/students/bulk-import', bulkImportStudents);
router.post('/students/:student_id/transfer', transferStudentDivision);

router.get('/attendance/live-summary', getLiveAttendanceSummary);
router.get('/attendance/audit-logs', getAttendanceAuditLogs);

module.exports = router;

