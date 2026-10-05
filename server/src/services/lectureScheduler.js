const cron = require('node-cron');
const { supabaseAdmin } = require('../config/db');
const { createNotification, sendToUsers } = require('./notificationService');
const { syncTodayLectures } = require('./timetableService');

let schedulerTask = null;
const memoryProcessedEvents = new Set(); // Fallback in-memory deduplication set

// Formats date in Asia/Kolkata timezone: YYYY-MM-DD
function getKolkataDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Returns YYYY-MM-DD
}

// Gets current Kolkata time as total minutes from midnight (0 to 1439)
function getKolkataMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

// Converts HH:MM or HH:MM:SS string to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks system_config for configurable reminder window (default: 10 minutes)
 */
async function getReminderWindowMinutes() {
  try {
    const { data } = await supabaseAdmin
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'lecture_reminder_window_minutes')
      .maybeSingle();

    if (data?.config_value) {
      const val = parseInt(data.config_value, 10);
      if (!isNaN(val) && val > 0 && val <= 60) return val;
    }
  } catch (_e) {}
  return 10; // Default 10 minutes
}

/**
 * Atomic claim pattern: Ensures only ONE worker processes this exact event key
 */
async function atomicClaimEvent(eventKey, { lectureId, lectureDate, notificationType, divisionId, startTime, studentCount }) {
  try {
    const { data: claim, error } = await supabaseAdmin
      .from('lecture_notification_logs')
      .insert({
        event_key: eventKey,
        lecture_id: lectureId,
        lecture_date: lectureDate,
        notification_type: notificationType,
        target_division_id: divisionId,
        scheduled_start_time: startTime,
        student_count: studentCount,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (!error && claim) {
      return true; // Successfully claimed!
    }
    if (error && error.code === '23505') {
      return false; // Unique violation: already claimed by another worker!
    }
  } catch (_e) {
    // If table not present yet in Supabase, fallback to memory
  }

  // Memory fallback deduplication
  if (memoryProcessedEvents.has(eventKey)) {
    return false;
  }
  memoryProcessedEvents.add(eventKey);
  return true;
}

/**
 * Core scheduler tick: runs every minute
 */
async function processUpcomingLectureReminders() {
  const todayStr = getKolkataDateString();
  const currentMinutes = getKolkataMinutes();
  const kolkataDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  // Sunday check (0 = Sunday is holiday)
  if (kolkataDate.getDay() === 0) {
    return;
  }

  // Ensure today's timetable slots are synced in database
  try {
    await syncTodayLectures(todayStr);
  } catch (err) {
    console.warn('[lectureScheduler] Timetable sync notice:', err.message);
  }

  // Retrieve advance reminder window (default 10 min)
  const windowMinutes = await getReminderWindowMinutes();

  // Query today's active lectures
  const { data: lectures, error } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      division_id,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name),
      teacher:teachers(id, teacher_id, user_id)
    `)
    .eq('lecture_date', todayStr);

  if (error || !lectures || lectures.length === 0) {
    return;
  }

  for (const lecture of lectures) {
    // 1. Skip cancelled or completed lectures
    if (lecture.status === 'CANCELLED' || lecture.status === 'COMPLETED') {
      continue;
    }

    // 2. Check start time window
    const startMinutes = timeToMinutes(lecture.start_time);
    const diff = startMinutes - currentMinutes;

    // Trigger if lecture starts between (windowMinutes - 1) and (windowMinutes + 1)
    if (diff > windowMinutes - 1 && diff <= windowMinutes + 1) {
      const eventKey = `START_${lecture.id}_${todayStr}`;
      const subjectName = lecture.subject?.name || lecture.topic || 'Class';
      const divisionName = lecture.division?.name || 'Class';
      const startTimeFormatted = lecture.start_time ? lecture.start_time.slice(0, 5) : '';

      // Find all students in this division
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('division_id', lecture.division_id);

      const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean);

      // ATOMIC CLAIM: Only 1 worker can claim this event key
      const claimed = await atomicClaimEvent(eventKey, {
        lectureId: lecture.id,
        lectureDate: todayStr,
        notificationType: 'LECTURE_STARTING',
        divisionId: lecture.division_id,
        startTime: lecture.start_time,
        studentCount: studentUserIds.length,
      });

      if (!claimed) {
        continue; // Already processed!
      }

      console.log(`⏰ [lectureScheduler] Dispatching lecture reminder for ${subjectName} (${divisionName}) starting at ${startTimeFormatted}`);

      // Dispatch to students in this division (Role: student)
      if (studentUserIds.length > 0) {
        await sendToUsers(studentUserIds, {
          type: 'LECTURE_STARTING',
          title: 'Lecture Starting Soon',
          message: `${subjectName} lecture starts in ${diff} minutes (${startTimeFormatted}). Room: Lab 2 / Classroom.`,
          relatedId: lecture.id,
          relatedType: 'lecture',
          metadata: {
            lecture_id: lecture.id,
            subject_name: subjectName,
            division_name: divisionName,
            start_time: lecture.start_time,
          },
        });
      }

      // Dispatch to assigned teacher (Role: teacher)
      const teacherUserId = lecture.teacher?.user_id;
      if (teacherUserId) {
        await createNotification({
          userId: teacherUserId,
          type: 'LECTURE_STARTING',
          title: 'Upcoming Teaching Lecture',
          message: `Your ${subjectName} lecture for ${divisionName} starts in ${diff} minutes (${startTimeFormatted}).`,
          relatedId: lecture.id,
          relatedType: 'lecture',
          metadata: {
            lecture_id: lecture.id,
            subject_name: subjectName,
            division_name: divisionName,
            is_faculty_reminder: true,
          },
        });
      }
    }
  }
}

/**
 * Helper: Notify students of lecture cancellation (Allows multiple legit events)
 */
async function notifyLectureCancellation(lectureId, reason = 'Faculty unavailable') {
  try {
    const { data: lecture } = await supabaseAdmin
      .from('lectures')
      .select('id, division_id, lecture_date, start_time, subject:subjects(name)')
      .eq('id', lectureId)
      .single();

    if (!lecture) return;

    const eventKey = `CANCEL_${lectureId}_${Date.now()}`;
    const subjectName = lecture.subject?.name || 'Scheduled lecture';

    const { data: students } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .eq('division_id', lecture.division_id);

    const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean);

    await atomicClaimEvent(eventKey, {
      lectureId,
      lectureDate: lecture.lecture_date,
      notificationType: 'LECTURE_CANCELLED',
      divisionId: lecture.division_id,
      startTime: lecture.start_time,
      studentCount: studentUserIds.length,
    });

    if (studentUserIds.length > 0) {
      await sendToUsers(studentUserIds, {
        type: 'LECTURE_CANCELLED',
        title: 'Lecture Cancelled',
        message: `Today's ${subjectName} lecture has been cancelled. Reason: ${reason}.`,
        relatedId: lectureId,
        relatedType: 'lecture',
        metadata: { lecture_id: lectureId, reason },
      });
    }
  } catch (err) {
    console.error('[lectureScheduler] Cancellation notification error:', err.message);
  }
}

/**
 * Helper: Notify students of lecture rescheduling (Allows multiple legit events)
 */
async function notifyLectureRescheduling(lectureId, newTime, newDate, reason = 'Schedule updated') {
  try {
    const { data: lecture } = await supabaseAdmin
      .from('lectures')
      .select('id, division_id, subject:subjects(name)')
      .eq('id', lectureId)
      .single();

    if (!lecture) return;

    const eventKey = `RESCHED_${lectureId}_${newTime}_${Date.now()}`;
    const subjectName = lecture.subject?.name || 'Class';

    const { data: students } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .eq('division_id', lecture.division_id);

    const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean);

    await atomicClaimEvent(eventKey, {
      lectureId,
      lectureDate: newDate,
      notificationType: 'LECTURE_RESCHEDULED',
      divisionId: lecture.division_id,
      startTime: newTime,
      studentCount: studentUserIds.length,
    });

    if (studentUserIds.length > 0) {
      await sendToUsers(studentUserIds, {
        type: 'LECTURE_RESCHEDULED',
        title: 'Lecture Rescheduled',
        message: `Your ${subjectName} lecture has been rescheduled to ${newDate} at ${newTime.slice(0, 5)}.`,
        relatedId: lectureId,
        relatedType: 'lecture',
        metadata: { lecture_id: lectureId, new_time: newTime, new_date: newDate, reason },
      });
    }
  } catch (err) {
    console.error('[lectureScheduler] Reschedule notification error:', err.message);
  }
}

/**
 * Initialize cron scheduler (runs every 60s)
 */
function initLectureScheduler() {
  if (schedulerTask) {
    return;
  }

  // Cron schedule: every minute
  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await processUpcomingLectureReminders();
    } catch (err) {
      console.error('[lectureScheduler] Error in reminder scheduler tick:', err.message);
    }
  });

  console.log('⏱️ [lectureScheduler] Lecture reminder scheduler initialized (Asia/Kolkata, check every 60s).');
}

module.exports = {
  initLectureScheduler,
  processUpcomingLectureReminders,
  notifyLectureCancellation,
  notifyLectureRescheduling,
  _memoryProcessedEvents: memoryProcessedEvents,
};
