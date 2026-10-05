const { supabaseAdmin } = require('../config/db');
const { createNotification } = require('./notificationService');

const memoryWarnings = new Set(); // Fallback key: `${studentId}_${subjectId}_${warningPeriodStart}`

// Get Monday of current calendar week in YYYY-MM-DD format
function getCurrentWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Checks system_config for low attendance threshold (default: 75%)
 */
async function getLowAttendanceThreshold() {
  try {
    const { data } = await supabaseAdmin
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'low_attendance_threshold')
      .maybeSingle();

    if (data?.config_value) {
      const val = parseFloat(data.config_value);
      if (!isNaN(val) && val > 0 && val <= 100) return val;
    }
  } catch (_e) {}
  return 75.0; // Default 75%
}

/**
 * Evaluates student attendance in a subject and dispatches atomic warning if below threshold
 */
async function checkAndNotifyLowAttendance(studentId, subjectId) {
  if (!studentId || !subjectId) return;

  try {
    // 1. Get student profile with user_id
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, user_id, division_id')
      .eq('id', studentId)
      .single();

    if (!student || !student.user_id) return;

    // 2. Get subject name
    const { data: subject } = await supabaseAdmin
      .from('subjects')
      .select('id, name')
      .eq('id', subjectId)
      .single();

    const subjectName = subject?.name || 'Class Subject';

    // 3. Calculate total lectures conducted for this division & subject
    const { count: totalLectures, error: totalErr } = await supabaseAdmin
      .from('lectures')
      .select('id', { count: 'exact', head: true })
      .eq('division_id', student.division_id)
      .eq('subject_id', subjectId)
      .neq('status', 'CANCELLED');

    // Only compute if at least 3 lectures conducted so far
    if (totalErr || !totalLectures || totalLectures < 3) {
      return;
    }

    // 4. Count attended lectures
    const { count: attendedCount, error: attErr } = await supabaseAdmin
      .from('attendance')
      .select('id, lectures!inner(division_id, subject_id)', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('lectures.subject_id', subjectId)
      .eq('status', 'PRESENT');

    if (attErr) return;

    const presentCount = attendedCount || 0;
    const percentage = Math.round((presentCount / totalLectures) * 100);

    const threshold = await getLowAttendanceThreshold();

    if (percentage < threshold) {
      const weekMonday = getCurrentWeekMonday();
      const warningKey = `${studentId}_${subjectId}_${weekMonday}`;

      // ATOMIC CLAIM: Try inserting into low_attendance_warnings
      let isClaimed = false;
      try {
        const { data: claim, error: claimErr } = await supabaseAdmin
          .from('low_attendance_warnings')
          .insert({
            student_id: studentId,
            subject_id: subjectId,
            warning_period_start: weekMonday,
            attendance_percentage: percentage,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();

        if (!claimErr && claim) {
          isClaimed = true;
        } else if (claimErr && claimErr.code === '23505') {
          isClaimed = false; // Already warned this week!
        }
      } catch (_e) {
        // Fallback to memory
        if (!memoryWarnings.has(warningKey)) {
          memoryWarnings.add(warningKey);
          isClaimed = true;
        }
      }

      if (!isClaimed) {
        return; // Already notified this week, skip duplicate spam!
      }

      console.log(`⚠️ [attendanceNotificationService] Sending low attendance warning to student ${student.user_id} (${subjectName}: ${percentage}%)`);

      await createNotification({
        userId: student.user_id,
        type: 'LOW_ATTENDANCE',
        title: 'Low Attendance Warning',
        message: `Your ${subjectName} attendance is ${percentage}%, which is below the required ${threshold}%. Please attend upcoming classes to maintain eligibility.`,
        relatedId: subjectId,
        relatedType: 'subject',
        metadata: {
          subject_id: subjectId,
          subject_name: subjectName,
          attendance_percentage: percentage,
          threshold,
          attended: presentCount,
          total: totalLectures,
        },
      });
    }
  } catch (err) {
    console.error('[attendanceNotificationService] Error:', err.message);
  }
}

module.exports = {
  checkAndNotifyLowAttendance,
  getCurrentWeekMonday,
  getLowAttendanceThreshold,
  _memoryWarnings: memoryWarnings,
};
