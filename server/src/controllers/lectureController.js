const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const {
  SMDL_TIMETABLE_MATRIX,
  DAY_NAMES,
  getSlotStatus,
  syncTodayLectures,
} = require('../services/timetableService');

function calculateDynamicStatus(l) {
  if (l.status && ['CANCELLED', 'RESCHEDULED'].includes(l.status)) return l.status;
  const today = new Date().toISOString().slice(0, 10);
  if (l.lecture_date < today) return 'COMPLETED';
  if (l.lecture_date > today) return 'SCHEDULED';
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = (l.start_time || '00:00').split(':').map(Number);
  const [eh, em] = (l.end_time || '23:59').split(':').map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 23) * 60 + (em || 59);
  if (currentMinutes < startMin) return 'UPCOMING';
  if (currentMinutes > endMin) return 'COMPLETED';
  return 'ONGOING';
}

// Student attendance window rule:
// Attendance is open from start_time until:
// min(end_time + 60 mins, start_time + 120 mins).
// Max duration allowed is 2 hours from start time.
function isLectureInAttendanceWindow(lecture, now = new Date()) {
  if (!lecture) return false;
  const todayStr = now.toISOString().split('T')[0];
  const lectureDateStr = (lecture.lecture_date || '').toString().slice(0, 10);
  if (lectureDateStr && lectureDateStr !== todayStr) {
    return false;
  }

  const [sh, sm] = (lecture.start_time || '00:00').split(':').map(Number);
  const [eh, em] = (lecture.end_time || '23:59').split(':').map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 1 hour after lecture ends, capped at max 2 hours (120 mins) from lecture start
  const expirationMin = Math.min(endMin + 60, startMin + 120);

  return nowMin >= startMin && nowMin <= expirationMin;
}

function getWindowExpirationTime(startTimeStr, endTimeStr) {
  const [sh, sm] = (startTimeStr || '00:00').split(':').map(Number);
  const [eh, em] = (endTimeStr || '23:59').split(':').map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  const expirationMin = Math.min(endMin + 60, startMin + 120);
  const h = String(Math.floor(expirationMin / 60)).padStart(2, '0');
  const m = String(expirationMin % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function attachTeacherNames(lectures) {
  const teacherUserIds = [...new Set((lectures || []).map((l) => (l.teachers || l.teacher)?.user_id).filter(Boolean))];
  const userMap = {};
  if (teacherUserIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .in('id', teacherUserIds);
    (users || []).forEach((u) => { userMap[u.id] = u.full_name; });
  }
  return (lectures || []).map((l) => {
    const tObj = l.teachers || l.teacher;
    const teacherName = (tObj?.user_id && userMap[tObj.user_id]) || 'Assigned Teacher';
    const status = calculateDynamicStatus(l);
    return {
      ...l,
      status,
      subject: l.subjects || l.subject,
      subjects: l.subjects || l.subject,
      division: l.divisions || l.division,
      divisions: l.divisions || l.division,
      teacher: {
        ...(tObj || {}),
        full_name: teacherName,
      },
      teachers: {
        ...(tObj || {}),
        full_name: teacherName,
      },
    };
  });
}

// @desc   Get active/today's lectures
// @route  GET /api/lectures/active
const getActiveLectures = asyncHandler(async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-sync today's timetable slots so they exist in DB
  try {
    await syncTodayLectures(todayStr);
  } catch (err) {
    console.error('Timetable auto-sync notice:', err.message);
  }

  let query = supabaseAdmin
    .from('lectures')
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      topic,
      created_at,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name),
      teacher:teachers(id, teacher_id, user_id)
    `)
    .eq('lecture_date', todayStr)
    .order('start_time', { ascending: true });

  let assignedSubjectIds = [];
  let teacherRecord = null;

  if (req.user.role === 'student') {
    // Find student's division
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('division_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (student?.division_id) {
      query = query.eq('division_id', student.division_id);
    }
  } else if (req.user.role === 'teacher') {
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    teacherRecord = teacher;

    if (teacher?.id) {
      const { data: tsRows } = await supabaseAdmin
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', teacher.id);
      assignedSubjectIds = (tsRows || []).map((r) => r.subject_id);
    }
  }

  const { data: lectures, error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  let mapped = await attachTeacherNames(lectures || []);

  // Filter strictly for teacher: ONLY assigned subjects or direct lectures
  if (req.user.role === 'teacher') {
    mapped = mapped.filter((l) => {
      const subId = l.subject?.id || l.subjects?.id;
      const tchId = l.teacher?.id || l.teachers?.id;
      return (teacherRecord?.id && tchId === teacherRecord.id) || (subId && assignedSubjectIds.includes(subId));
    });
  }

  // Filter strictly for student: ONLY lectures currently within active attendance window
  if (req.user.role === 'student') {
    const now = new Date();
    mapped = mapped
      .filter((l) => isLectureInAttendanceWindow(l, now))
      .map((l) => ({
        ...l,
        is_active_now: true,
        window_expires_at: getWindowExpirationTime(l.start_time, l.end_time),
      }));
  }

  res.json({
    success: true,
    data: { lectures: mapped },
  });
});

// @desc   Get comprehensive today schedule for Teacher / Admin
// @route  GET /api/lectures/today
const getTodaySchedule = asyncHandler(async (req, res) => {
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
  const targetDate = new Date(targetDateStr);
  const dayName = DAY_NAMES[targetDate.getDay()];

  // Sync timetable for requested date
  try {
    await syncTodayLectures(targetDateStr);
  } catch (err) {
    console.error('Timetable sync error:', err.message);
  }

  // Get current teacher record & their assigned subjects
  let currentTeacher = null;
  let teacherAssignedSubjIds = [];
  if (req.user.role === 'teacher') {
    const { data: tRec } = await supabaseAdmin
      .from('teachers')
      .select('id, teacher_id, user_id, department, users(id, full_name, email)')
      .eq('user_id', req.user.id)
      .maybeSingle();
    currentTeacher = tRec;

    if (tRec?.id) {
      const { data: tsList } = await supabaseAdmin
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', tRec.id);
      teacherAssignedSubjIds = (tsList || []).map((r) => r.subject_id);
    }
  }

  // Fetch all lectures for target date
  const { data: lectures, error } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      topic,
      created_at,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name),
      teacher:teachers(id, teacher_id, user_id)
    `)
    .eq('lecture_date', targetDateStr)
    .order('start_time', { ascending: true });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  const mapped = await attachTeacherNames(lectures || []);

  // Filter for logged-in teacher: strictly their assigned subjects & lectures
  const myLectures = currentTeacher
    ? mapped.filter((l) => {
        const subId = l.subject?.id || l.subjects?.id;
        const tchId = l.teacher?.id || l.teachers?.id;
        return (tchId === currentTeacher.id) || (subId && teacherAssignedSubjIds.includes(subId));
      })
    : mapped;

  // Accessible lectures for teacher must strictly be their assigned lectures
  const accessibleLectures = req.user.role === 'teacher' ? myLectures : mapped;

  // Find ongoing and next upcoming
  const ongoing = accessibleLectures.find((l) => l.status === 'ONGOING') || null;
  const nextUpcoming = accessibleLectures.find((l) => l.status === 'UPCOMING') || null;

  res.json({
    success: true,
    data: {
      date: targetDateStr,
      day_name: dayName,
      is_holiday: dayName === 'Sunday',
      teacher: currentTeacher ? {
        id: currentTeacher.id,
        name: currentTeacher.users?.full_name,
        teacher_id: currentTeacher.teacher_id,
      } : null,
      my_lectures: myLectures,
      all_lectures: accessibleLectures,
      current_lecture: ongoing,
      next_lecture: nextUpcoming,
      summary: {
        total_today: accessibleLectures.length,
        my_total_today: myLectures.length,
        has_ongoing: !!ongoing,
      },
    },
  });
});

// @desc   Get Full Weekly Timetable Matrix
// @route  GET /api/lectures/timetable
const getTimetableMatrix = asyncHandler(async (req, res) => {
  const today = new Date();
  const currentDay = DAY_NAMES[today.getDay()];
  const currentDate = today.toISOString().split('T')[0];

  res.json({
    success: true,
    data: {
      matrix: SMDL_TIMETABLE_MATRIX,
      current_day: currentDay,
      current_date: currentDate,
      current_time: `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`,
    },
  });
});

// @desc   Get all scheduled lectures (Admin & Teacher roster)
// @route  GET /api/lectures
const getAllLectures = asyncHandler(async (req, res) => {
  const { data: lectures, error } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      topic,
      created_at,
      subjects:subjects(id, name, code),
      divisions:divisions(id, name, division_name),
      teachers:teachers(id, teacher_id, user_id)
    `)
    .order('lecture_date', { ascending: false });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  const mapped = await attachTeacherNames(lectures || []);

  res.json({
    success: true,
    count: mapped.length,
    data: { lectures: mapped },
  });
});

// @desc   Teacher/Admin creates/starts a new lecture session
// @route  POST /api/lectures
const createLecture = asyncHandler(async (req, res) => {
  const { subject_id, division_id, topic, start_time, end_time, lecture_date } = req.body;
  let { teacher_id } = req.body;

  if (!subject_id || !division_id) {
    res.status(400);
    throw new Error('Subject and Division are required');
  }

  if (!teacher_id) {
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (teacher) {
      teacher_id = teacher.id;
    }
  }

  if (!teacher_id && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Teacher identification is required');
  }

  const todayStr = lecture_date || new Date().toISOString().split('T')[0];
  const now = new Date();
  const defaultStartTime = start_time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const defaultEndTime = end_time || '23:59:59';

  const insertData = {
    subject_id,
    division_id,
    lecture_date: todayStr,
    start_time: defaultStartTime,
    end_time: defaultEndTime,
    topic: topic || 'Regular Lecture',
    created_by: req.user.id,
  };

  if (teacher_id) {
    insertData.teacher_id = teacher_id;
  }

  const { data: lecture, error } = await supabaseAdmin
    .from('lectures')
    .insert(insertData)
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      topic,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name)
    `)
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.status(201).json({
    success: true,
    message: 'Lecture scheduled successfully',
    data: { lecture },
  });
});

// @desc   Update lecture status
// @route  PATCH /api/lectures/:id/status
const updateLectureStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data: updated, error } = await supabaseAdmin
    .from('lectures')
    .update({ status })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    // If column doesn't exist, acknowledge safely
    return res.json({
      success: true,
      message: `Lecture status marked as ${status}`,
      data: { id, status },
    });
  }

  // Notify students if lecture was cancelled or rescheduled
  (async () => {
    try {
      const { notifyLectureCancellation, notifyLectureRescheduling } = require('../services/lectureScheduler');
      if (status === 'CANCELLED') {
        await notifyLectureCancellation(id, req.body.reason || 'Class cancelled');
      } else if (status === 'RESCHEDULED') {
        const newTime = req.body.new_time || updated?.start_time || '14:00';
        const newDate = req.body.new_date || updated?.lecture_date || new Date().toISOString().split('T')[0];
        await notifyLectureRescheduling(id, newTime, newDate, req.body.reason || 'Timetable updated');
      }
    } catch (_e) {}
  })();

  res.json({
    success: true,
    message: `Lecture marked as ${status}`,
    data: { lecture: updated },
  });
});

// @desc   Delete / cancel lecture
// @route  DELETE /api/lectures/:id
const deleteLecture = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('lectures')
    .delete()
    .eq('id', id);

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    message: 'Lecture deleted successfully',
  });
});

// @desc   Live query today's classes for student from division timetable (Fix #4: No cron, live query)
// @route  GET /api/lectures/today-classes
const getStudentTodayClasses = asyncHandler(async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const dayName = DAY_NAMES[new Date().getDay()];

  // 1. Find student's division
  let divisionId = req.query.division_id;
  let studentRecord = null;

  if (req.user.role === 'student') {
    const { data: stu } = await supabaseAdmin
      .from('students')
      .select('id, student_id, division_id, division:divisions(id, name, division_name)')
      .eq('user_id', req.user.id)
      .maybeSingle();

    studentRecord = stu;
    divisionId = stu?.division_id || divisionId;
  }

  if (!divisionId) {
    // If division not assigned yet, try to find default division
    const { data: defaultDiv } = await supabaseAdmin
      .from('divisions')
      .select('id, name')
      .limit(1)
      .maybeSingle();
    divisionId = defaultDiv?.id;
  }

  // 2. Query division_timetables live by day of week (Section 3)
  let liveClasses = [];
  let isFromTimetable = false;

  if (divisionId) {
    const { data: slots, error: slotErr } = await supabaseAdmin
      .from('division_timetables')
      .select(`
        id,
        division_id,
        day_of_week,
        start_time,
        end_time,
        room_number,
        is_lab,
        subject:subjects(id, name, code),
        teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name, email))
      `)
      .eq('division_id', divisionId)
      .eq('day_of_week', dayName)
      .order('start_time', { ascending: true });

    if (!slotErr && slots && slots.length > 0) {
      isFromTimetable = true;

      // Check attendance for student
      let attendanceMap = {};
      if (studentRecord?.id) {
        const { data: attRecords } = await supabaseAdmin
          .from('attendance_records')
          .select('id, timetable_id, status, marked_at')
          .eq('student_id', studentRecord.id)
          .eq('attendance_date', todayStr);

        (attRecords || []).forEach((r) => {
          attendanceMap[r.timetable_id] = r;
        });
      }

      const now = new Date();
      liveClasses = slots.map((s) => {
        const status = getSlotStatus(s.start_time, s.end_time, todayStr);
        const att = attendanceMap[s.id];
        const canMark = isLectureInAttendanceWindow({ start_time: s.start_time, end_time: s.end_time, lecture_date: todayStr }, now);
        return {
          id: s.id,
          timetable_id: s.id,
          subject_name: s.subject?.name || 'Class',
          subject_code: s.subject?.code || '',
          teacher_name: s.teacher?.user?.full_name || 'Assigned Faculty',
          room_number: s.room_number || 'Room 101',
          is_lab: !!s.is_lab,
          start_time: s.start_time,
          end_time: s.end_time,
          status,
          is_attended: att?.status === 'PRESENT',
          attendance_status: att ? att.status : 'NOT_MARKED',
          marked_at: att?.marked_at || null,
          can_mark_attendance: canMark,
          window_expires_at: getWindowExpirationTime(s.start_time, s.end_time),
        };
      });
    }
  }

  // 3. Graceful fallback if division_timetables table not yet migrated or empty for this division
  if (!isFromTimetable && divisionId) {
    try {
      await syncTodayLectures(todayStr);
    } catch (_e) {}

    const { data: lectures } = await supabaseAdmin
      .from('lectures')
      .select(`
        id,
        lecture_date,
        start_time,
        end_time,
        topic,
        subject:subjects(id, name, code),
        teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name))
      `)
      .eq('lecture_date', todayStr)
      .eq('division_id', divisionId)
      .order('start_time', { ascending: true });

    if (lectures && lectures.length > 0) {
      let attMap = {};
      if (studentRecord?.id) {
        const { data: att } = await supabaseAdmin
          .from('attendance')
          .select('id, lecture_id, status, marked_at')
          .eq('student_id', studentRecord.id)
          .in('lecture_id', lectures.map((l) => l.id));

        (att || []).forEach((a) => {
          attMap[a.lecture_id] = a;
        });
      }

      const now = new Date();
      liveClasses = lectures.map((l) => {
        const status = getSlotStatus(l.start_time, l.end_time, todayStr);
        const att = attMap[l.id];
        const canMark = isLectureInAttendanceWindow({ start_time: l.start_time, end_time: l.end_time, lecture_date: todayStr }, now);
        return {
          id: l.id,
          timetable_id: l.id,
          subject_name: l.subject?.name || l.topic || 'Class',
          subject_code: l.subject?.code || '',
          teacher_name: l.teacher?.user?.full_name || 'Assigned Faculty',
          room_number: 'Room 101',
          is_lab: (l.topic || '').toLowerCase().includes('lab') || (l.topic || '').toLowerCase().includes('practical'),
          start_time: l.start_time,
          end_time: l.end_time,
          status,
          is_attended: att?.status === 'PRESENT',
          attendance_status: att ? att.status : 'NOT_MARKED',
          marked_at: att?.marked_at || null,
          can_mark_attendance: canMark,
          window_expires_at: getWindowExpirationTime(l.start_time, l.end_time),
        };
      });
    }
  }

  // Filter if active_only query param is present
  if (req.query.active_only === 'true') {
    liveClasses = liveClasses.filter((c) => c.can_mark_attendance);
  }

  res.json({
    success: true,
    data: {
      date: todayStr,
      day_name: dayName,
      is_holiday: dayName === 'Sunday',
      classes_count: liveClasses.length,
      classes: liveClasses,
      source: isFromTimetable ? 'division_timetables' : 'daily_lectures',
    },
  });
});

module.exports = {
  getActiveLectures,
  getAllLectures,
  createLecture,
  updateLectureStatus,
  deleteLecture,
  getTodaySchedule,
  getTimetableMatrix,
  getStudentTodayClasses,
};


