/**
 * Resolves the application target URL based on notification category, metadata, and user role.
 */
function resolveNotificationActionUrl(type, metadata = {}, userRole = 'student') {
  const normalizedType = (type || 'SYSTEM').toUpperCase();

  switch (normalizedType) {
    case 'ANNOUNCEMENT':
    case 'NEW_STUDY_MATERIAL':
    case 'STUDY_MATERIAL':
      if (userRole === 'teacher') return '/teacher/announce';
      if (userRole === 'admin') return '/admin/announcements';
      return '/student/announce';

    case 'ATTENDANCE_MARKED':
    case 'ATTENDANCE_CORRECTED':
    case 'ATTENDANCE_REMOVED':
      if (userRole === 'teacher') return '/teacher/attendance';
      return '/student/attendance';

    case 'LOW_ATTENDANCE':
      if (userRole === 'teacher') return '/teacher/reports';
      if (userRole === 'admin') return '/admin/reports';
      return '/student/reports';

    case 'LECTURE_STARTING':
      if (userRole === 'teacher') return '/teacher/classes';
      return '/student/mark';

    case 'LECTURE_CANCELLED':
    case 'LECTURE_RESCHEDULED':
      if (userRole === 'teacher') return '/teacher/classes';
      return '/student';

    case 'TEACHER_APPROVED':
      return '/teacher';

    case 'TEACHER_REJECTED':
      return '/pending-approval';

    case 'PASSWORD_RESET':
      return '/reset-password';

    case 'PASSWORD_CHANGED':
    case 'SECURITY_ALERT':
      if (userRole === 'admin') return '/admin';
      if (userRole === 'teacher') return '/teacher';
      return '/student';

    default:
      if (metadata && metadata.actionUrl) return metadata.actionUrl;
      return '/';
  }
}

module.exports = {
  resolveNotificationActionUrl,
};
