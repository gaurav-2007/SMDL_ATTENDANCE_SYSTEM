const { supabaseAdmin } = require('../config/db');
const { createNotification } = require('./notificationService');
const { getKolkataDateString } = require('../utils/dateUtils');

const memoryWarnings = new Set(); // Fallback key: `${studentId}_${subjectId}_${warningPeriodStart}`

// Get Monday of current calendar week in YYYY-MM-DD format strictly in Asia/Kolkata (IST)
function getCurrentWeekMonday(referenceDate = new Date()) {
  const istDateStr = getKolkataDateString(referenceDate);
  const [year, month, day] = istDateStr.split('-').map(Number);
  const utcDayObj = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  const dayOfWeek = utcDayObj.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  utcDayObj.setUTCDate(utcDayObj.getUTCDate() + diffToMonday);
  return utcDayObj.toISOString().slice(0, 10);
}

/**
 * Checks system_config global toggle for low attendance warnings (default: enabled)
 */
async function isLowAttendanceRemindersEnabled() {
  try {
    const { data } = await supabaseAdmin
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'low_attendance_reminders_enabled')
      .maybeSingle();

    if (data?.config_value !== undefined && data?.config_value !== null) {
      return String(data.config_value).trim().toLowerCase() !== 'false';
    }
  } catch (_e) {}
  return true;
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
    const warningsEnabled = await isLowAttendanceRemindersEnabled();
    if (!warningsEnabled) return;

    // 1. Get student profile with user_id & division_id
    const { data: student, error: studErr } = await supabaseAdmin
      .from('students')
      .select('id, user_id, division_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studErr) {
      console.warn('[attendanceNotificationService] Failed loading student profile:', studErr.message);
      return;
    }
    if (!student || !student.user_id || !student.division_id) return;

    // 2. Get subject name safely (handles missing subject gracefully)
    const { data: subject } = await supabaseAdmin
      .from('subjects')
      .select('id, name')
      .eq('id', subjectId)
      .maybeSingle();

    const subjectName = subject?.name || 'Class Subject';

    // 3. Calculate total non-cancelled lectures conducted for this division & subject
    let { count: totalLectures, error: totalErr } = await supabaseAdmin
      .from('lectures')
      .select('id', { count: 'exact', head: true })
      .eq('division_id', student.division_id)
      .eq('subject_id', subjectId)
      .neq('status', 'CANCELLED');

    if (totalErr && (totalErr.code === '42703' || String(totalErr.message).includes('status'))) {
      const retry = await supabaseAdmin
        .from('lectures')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', student.division_id)
        .eq('subject_id', subjectId);
      totalLectures = retry.count;
      totalErr = retry.error;
    }

    if (totalErr) {
      console.warn('[attendanceNotificationService] Failed counting conducted lectures:', totalErr.message);
      return;
    }

    // Only compute if at least 3 non-cancelled lectures conducted so far
    if (!totalLectures || totalLectures < 3) {
      return;
    }

    // 4. Count attended lectures (scoped to student's division & non-cancelled lectures)
    let { count: attendedCount, error: attErr } = await supabaseAdmin
      .from('attendance')
      .select('id, lectures!inner(division_id, subject_id, status)', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('lectures.division_id', student.division_id)
      .eq('lectures.subject_id', subjectId)
      .neq('lectures.status', 'CANCELLED')
      .eq('status', 'PRESENT');

    if (attErr && (attErr.code === '42703' || String(attErr.message).includes('status'))) {
      const retryAtt = await supabaseAdmin
        .from('attendance')
        .select('id, lectures!inner(division_id, subject_id)', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('lectures.division_id', student.division_id)
        .eq('lectures.subject_id', subjectId)
        .eq('status', 'PRESENT');
      attendedCount = retryAtt.count;
      attErr = retryAtt.error;
    }

    if (attErr) {
      console.warn('[attendanceNotificationService] Failed counting attended lectures:', attErr.message);
      return;
    }

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
        } else if (claimErr) {
          console.warn('[attendanceNotificationService] Warning deduplication table error:', claimErr.message);
          if (!memoryWarnings.has(warningKey)) {
            memoryWarnings.add(warningKey);
            isClaimed = true;
          }
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
