const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { assertActiveUser } = require('../middleware/roles');
const {
  SMDL_TIMETABLE_MATRIX,
  DAY_NAMES,
  getSlotStatus,
  syncTodayLectures,
} = require('../services/timetableService');
const {
  getKolkataDateString,
  getKolkataDayName,
  getKolkataTimeString,
  getKolkataMinutes,
} = require('../utils/dateUtils');

const VALID_LECTURE_STATUSES = ['SCHEDULED', 'ACTIVE', 'ONGOING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];

function parseStrictTime(timeStr) {
  if (typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] !== undefined ? parseInt(match[3], 10) : 0;
  return {
    minutes: h * 60 + m,
    formatted: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
  };
}

function minutesToTimeStr(totalMinutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function parseValidDateToKolkata(dateInput, res) {
  if (typeof dateInput !== 'string' || !dateInput.trim()) {
    res.status(400);
    throw new Error('Invalid lecture_date format');
  }
  const trimmed = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, mo, d] = trimmed.split('-').map(Number);
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() !== mo - 1 ||
      probe.getUTCDate() !== d
    ) {
      res.status(400);
      throw new Error(`Invalid calendar date: ${trimmed}`);
    }
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    res.status(400);
    throw new Error('Invalid lecture_date format');
  }
  return getKolkataDateString(parsed);
}

function resolveScheduleTimes({ currentStart, currentEnd, newStartInput, newEndInput, res }) {
  const hasStart = newStartInput !== undefined && newStartInput !== null && String(newStartInput).trim() !== '';
  const hasEnd = newEndInput !== undefined && newEndInput !== null && String(newEndInput).trim() !== '';

  const origStart = parseStrictTime(String(currentStart || ''));
  const origEnd = parseStrictTime(String(currentEnd || ''));

  if (hasStart) {
    const parsedStart = parseStrictTime(String(newStartInput));
    if (!parsedStart) {
      res.status(400);
      throw new Error('Invalid start_time format. Expected HH:MM or HH:MM:SS');
    }

    if (hasEnd) {
      const parsedEnd = parseStrictTime(String(newEndInput));
      if (!parsedEnd) {
        res.status(400);
        throw new Error('Invalid end_time format. Expected HH:MM or HH:MM:SS');
      }
      if (parsedEnd.minutes <= parsedStart.minutes) {
        res.status(400);
        throw new Error('Invalid time range: end_time must be strictly after start_time');
      }
      return { start_time: parsedStart.formatted, end_time: parsedEnd.formatted };
    }

    // Preserve original duration when start_time changes without explicit end_time
    if (!origStart || !origEnd || origEnd.minutes <= origStart.minutes) {
      res.status(400);
      throw new Error('Cannot reliably preserve lecture duration; please provide a valid end_time');
    }
    if (parsedStart.minutes >= 23 * 60 + 59) {
      res.status(400);
      throw new Error('Invalid start_time: rescheduled lecture cannot start at or past 23:59');
    }
    const origDuration = origEnd.minutes - origStart.minutes;
    const candidateEndMin = parsedStart.minutes + origDuration;
    if (candidateEndMin > 23 * 60 + 59) {
      res.status(400);
      throw new Error('Invalid start_time: preserved lecture duration would exceed 23:59');
    }
    if (candidateEndMin <= parsedStart.minutes) {
      res.status(400);
      throw new Error('Invalid time range: rescheduled end_time cannot precede start_time');
    }
    return {
      start_time: parsedStart.formatted,
      end_time: minutesToTimeStr(candidateEndMin),
    };
  }

  if (hasEnd) {
    const parsedEnd = parseStrictTime(String(newEndInput));
    if (!parsedEnd) {
      res.status(400);
      throw new Error('Invalid end_time format. Expected HH:MM or HH:MM:SS');
    }
    if (!origStart || parsedEnd.minutes <= origStart.minutes) {
      res.status(400);
      throw new Error('Invalid time range: end_time must be strictly after start_time');
    }
    return { start_time: origStart.formatted, end_time: parsedEnd.formatted };
  }

  return { start_time: currentStart, end_time: currentEnd };
}

function normalizeTopicForStatus(rawTopic, targetStatus, { preserveRescheduled = false } = {}) {
  const cleanTopic = (rawTopic || 'Lecture').replace(/\[(CANCELLED|RESCHEDULED)\]\s*/g, '').trim() || 'Lecture';
  if (targetStatus === 'CANCELLED') {
    return `[CANCELLED] ${cleanTopic}`;
  }
  const keepRescheduled =
    targetStatus === 'RESCHEDULED' ||
    (preserveRescheduled && ['RESCHEDULED', 'ONGOING', 'COMPLETED'].includes(targetStatus));
  if (keepRescheduled) {
    return `[RESCHEDULED] ${cleanTopic}`;
  }
  return cleanTopic;
}

function isLectureCancelled(l) {
  if (!l) return false;
  if (l.status === 'CANCELLED') return true;
  const st = l.status ? String(l.status).toUpperCase() : 'SCHEDULED';
  return ['SCHEDULED', 'ACTIVE'].includes(st) && Boolean(l.topic && l.topic.includes('[CANCELLED]'));
}

function normalizePersistedStatus(status) {
  if (!status) return 'SCHEDULED';
  return status === 'ACTIVE' ? 'SCHEDULED' : status;
}

function hasExplicitRescheduleProvenance(l) {
  if (!l || isLectureCancelled(l)) return false;
  if (normalizePersistedStatus(l.status) === 'RESCHEDULED') return true;
  return Boolean(l.topic && l.topic.includes('[RESCHEDULED]'));
}

async function requireTeacherProfile(user, res) {
  const { data: teacherRec, error: tchErr } = await supabaseAdmin
    .from('teachers')
    .select('id, user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (tchErr) {
    console.error('[lectureController] Failed to verify teacher profile:', tchErr.message);
    res.status(500);
    throw new Error('Failed to verify teacher profile');
  }
  if (!teacherRec || !teacherRec.id) {
    res.status(403);
    throw new Error('Access Denied: Teacher profile not found');
  }
  return teacherRec;
}

function assertActiveAdminOrTeacher(user, res) {
  assertActiveUser(user, res);
  if (!['admin', 'teacher'].includes(user.role)) {
    res.status(403);
    throw new Error('Access Denied: Admin or teacher privileges required');
  }
}

async function assertTeacherAuthorizedForSubjectDivision(teacherId, subjectId, divisionId, res) {
  if (!teacherId || !subjectId || !divisionId) {
    res.status(403);
    throw new Error('Access Denied: Subject and division assignment required to manage this lecture');
  }

  const [
    { data: subjectRec, error: subjErr },
    { data: tsRows, error: tsErr },
    { data: ttRows, error: ttErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('subjects')
      .select('id, division_id')
      .eq('id', subjectId)
      .maybeSingle(),
    supabaseAdmin
      .from('teacher_subjects')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('subject_id', subjectId)
      .limit(1),
    supabaseAdmin
      .from('division_timetables')
      .select('id')
      .eq('division_id', divisionId)
      .eq('subject_id', subjectId)
      .eq('teacher_id', teacherId)
      .limit(1),
  ]);

  if (subjErr) {
    console.error('[lectureController] Failed to verify subject division:', subjErr.message);
    res.status(500);
    throw new Error('Failed to verify subject division');
  }
  if (tsErr) {
    console.error('[lectureController] Failed to verify teacher subject assignment:', tsErr.message);
    res.status(500);
    throw new Error('Failed to verify teacher subject assignment');
  }
  if (ttErr && ttErr.code !== '42P01') {
    console.error('[lectureController] Failed to verify division timetable assignment:', ttErr.message);
    res.status(500);
    throw new Error('Failed to verify division timetable assignment');
  }

  if (!subjectRec || (subjectRec.division_id && subjectRec.division_id !== divisionId)) {
    res.status(403);
    throw new Error('Access Denied: This subject belongs to a different division');
  }

  const hasTimetableAssignment = !ttErr && Array.isArray(ttRows) && ttRows.length > 0;
  if (hasTimetableAssignment) {
    return true;
  }

  const hasTeacherSubject = Array.isArray(tsRows) && tsRows.length > 0;
  if (subjectRec.division_id === divisionId && hasTeacherSubject) {
    return true;
  }

  res.status(403);
  throw new Error('Access Denied: Unable to verify subject and division assignment for this teacher');
}

async function assertTeacherCanManageLecture(user, lecture, res) {
  assertActiveUser(user, res);
  if (user.role === 'admin') {
    return null;
  }
  if (user.role !== 'teacher') {
    res.status(403);
    throw new Error('Access Denied: Insufficient permissions');
  }

  const teacherRec = await requireTeacherProfile(user, res);
  if (lecture.teacher_id) {
    if (lecture.teacher_id === teacherRec.id) {
      return teacherRec;
    }
    res.status(403);
    throw new Error('Access Denied: This lecture is assigned to another teacher');
  }

  await assertTeacherAuthorizedForSubjectDivision(
    teacherRec.id,
    lecture.subject_id,
    lecture.division_id,
    res
  );
  return teacherRec;
}

function calculateDynamicStatus(l) {
  if (!l) return 'SCHEDULED';
  if (isLectureCancelled(l)) return 'CANCELLED';

  const persisted = normalizePersistedStatus(l.status);
  // Explicit terminal or live statuses take precedence over topic tags and clock heuristics
  if (persisted === 'COMPLETED') {
    return 'COMPLETED';
  }

  const today = getKolkataDateString();
  if (persisted === 'ONGOING') {
    if (l.lecture_date && l.lecture_date < today) return 'COMPLETED';
    return 'ONGOING';
  }

  // Past lectures (including past RESCHEDULED) must complete automatically
  if (l.lecture_date && l.lecture_date < today) {
    return 'COMPLETED';
  }

  const rawUpper = l.status ? String(l.status).toUpperCase() : 'SCHEDULED';
  const isRescheduled =
    persisted === 'RESCHEDULED' ||
    (['SCHEDULED', 'ACTIVE'].includes(rawUpper) && Boolean(l.topic && l.topic.includes('[RESCHEDULED]')));

  if (l.lecture_date && l.lecture_date > today) {
    return isRescheduled ? 'RESCHEDULED' : 'SCHEDULED';
  }

  const currentMinutes = getKolkataMinutes();
  const parsedStart = parseStrictTime(String(l.start_time || ''));
  const parsedEnd = parseStrictTime(String(l.end_time || ''));
  const startMin = parsedStart ? parsedStart.minutes : 0;
  const endMin = parsedEnd ? parsedEnd.minutes : 23 * 60 + 59;
  if (currentMinutes > endMin) return 'COMPLETED';
  if (currentMinutes >= startMin) return 'ONGOING';
  return isRescheduled ? 'RESCHEDULED' : 'UPCOMING';
}

// Student attendance window rule:
// Attendance is open from start_time until:
// min(end_time + 60 mins, start_time + 120 mins).
// Max duration allowed is 2 hours from start time.
function isLectureInAttendanceWindow(lecture, now = new Date()) {
  if (!lecture) return false;
  if (isLectureCancelled(lecture)) return false;
  const todayStr = getKolkataDateString(now);
  const lectureDateStr = (lecture.lecture_date || '').toString().slice(0, 10);
  if (lectureDateStr && lectureDateStr !== todayStr) {
    return false;
  }

  const parsedStart = parseStrictTime(String(lecture.start_time || '00:00'));
  const parsedEnd = parseStrictTime(String(lecture.end_time || '23:59'));
  const startMin = parsedStart ? parsedStart.minutes : 0;
  const endMin = parsedEnd ? parsedEnd.minutes : 23 * 60 + 59;
  const nowMin = getKolkataMinutes(now);

  // 1 hour after lecture ends, capped at max 2 hours (120 mins) from lecture start, never past 23:59
  const expirationMin = Math.min(endMin + 60, startMin + 120, 23 * 60 + 59);

  return nowMin >= startMin && nowMin <= expirationMin;
}

function getWindowExpirationTime(startTimeStr, endTimeStr) {
  const parsedStart = parseStrictTime(String(startTimeStr || '00:00'));
  const parsedEnd = parseStrictTime(String(endTimeStr || '23:59'));
  const startMin = parsedStart ? parsedStart.minutes : 0;
  const endMin = parsedEnd ? parsedEnd.minutes : 23 * 60 + 59;
  const expirationMin = Math.min(endMin + 60, startMin + 120, 23 * 60 + 59);
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
    const cleanTopic = (l.topic || '').replace(/\[(CANCELLED|RESCHEDULED)\]\s*/g, '').trim() || l.topic;
    return {
      ...l,
      topic: cleanTopic,
      raw_topic: l.topic,
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

async function loadTeacherAccessContext(userId, res) {
  const { data: teacherRec, error: tchErr } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, user_id, department, users(id, full_name, email)')
    .eq('user_id', userId)
    .maybeSingle();

  if (tchErr) {
    console.error('[lectureController] Teacher context lookup failed:', tchErr.message);
    res.status(500);
    throw new Error('Failed to verify teacher profile');
  }
  if (!teacherRec?.id) {
    return { teacherRec: null, assignedSubjectIds: new Set(), timetablePairs: new Set() };
  }

  const [{ data: tsRows, error: tsErr }, { data: ttRows, error: ttErr }] = await Promise.all([
    supabaseAdmin.from('teacher_subjects').select('subject_id').eq('teacher_id', teacherRec.id),
    supabaseAdmin.from('division_timetables').select('division_id, subject_id').eq('teacher_id', teacherRec.id),
  ]);

  if (tsErr) {
    console.error('[lectureController] teacher_subjects context lookup failed:', tsErr.message);
    res.status(500);
    throw new Error('Failed to load assigned subjects');
  }
  if (ttErr && ttErr.code !== '42P01') {
    console.error('[lectureController] division_timetables context lookup failed:', ttErr.message);
    res.status(500);
    throw new Error('Failed to load timetable assignments');
  }

  const assignedSubjectIds = new Set((tsRows || []).map((r) => r.subject_id).filter(Boolean));
  const timetablePairs = new Set(
    (ttRows || [])
      .filter((r) => r.division_id && r.subject_id)
      .map((r) => `${r.division_id}-${r.subject_id}`)
  );

  return { teacherRec, assignedSubjectIds, timetablePairs };
}

function isTeacherAuthorizedForSubjectDivInCtx(teacherCtx, subId, divId, subjectObj) {
  if (!teacherCtx?.teacherRec?.id || !subId || !divId || !subjectObj) {
    return false;
  }
  const subjDivId = subjectObj.division_id || null;
  if (subjDivId && subjDivId !== divId) {
    return false;
  }
  if (teacherCtx.timetablePairs.has(`${divId}-${subId}`)) {
    return true;
  }
  if (subjDivId === divId && teacherCtx.assignedSubjectIds.has(subId)) {
    return true;
  }
  return false;
}

function evaluateTeacherLectureAccess(teacherCtx, l) {
  if (!teacherCtx?.teacherRec?.id) {
    return { visible: false, is_owner: false, can_manage: false, view_only: true };
  }
  const tchId = l.teacher?.id || l.teachers?.id || l.teacher_id || null;
  const subId = l.subject?.id || l.subjects?.id || l.subject_id || null;
  const divId = l.division?.id || l.divisions?.id || l.division_id || null;
  const subjectObj = l.subject || l.subjects || null;

  if (tchId) {
    if (tchId === teacherCtx.teacherRec.id) {
      return { visible: true, is_owner: true, can_manage: true, view_only: false };
    }
    const authorizedShared = isTeacherAuthorizedForSubjectDivInCtx(teacherCtx, subId, divId, subjectObj);
    return { visible: authorizedShared, is_owner: false, can_manage: false, view_only: true };
  }

  const canManage = isTeacherAuthorizedForSubjectDivInCtx(teacherCtx, subId, divId, subjectObj);
  return { visible: canManage, is_owner: false, can_manage: canManage, view_only: !canManage };
}

// @desc   Get active/today's lectures
// @route  GET /api/lectures/active
const getActiveLectures = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  if (!['student', 'teacher', 'admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Access Denied: Insufficient permissions');
  }

  const todayStr = getKolkataDateString();
  let studentDivisionId = null;

  if (req.user.role === 'student') {
    const { data: student, error: studErr } = await supabaseAdmin
      .from('students')
      .select('id, division_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (studErr) {
      console.error('[lectureController] Failed verifying student division in getActiveLectures:', studErr.message);
      res.status(500);
      throw new Error('Failed to verify student division');
    }
    if (!student || !student.division_id) {
      return res.json({
        success: true,
        data: { lectures: [] },
      });
    }
    studentDivisionId = student.division_id;
  }

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
      division_id,
      subject_id,
      teacher_id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      created_at,
      subject:subjects(id, name, code, division_id),
      division:divisions(id, name, division_name),
      teacher:teachers(id, teacher_id, user_id)
    `)
    .eq('lecture_date', todayStr)
    .order('start_time', { ascending: true });

  let teacherCtx = null;

  if (req.user.role === 'student') {
    query = query.eq('division_id', studentDivisionId);
  } else if (req.user.role === 'teacher') {
    teacherCtx = await loadTeacherAccessContext(req.user.id, res);
  }

  const { data: lectures, error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  let mapped = await attachTeacherNames(lectures || []);

  // For active lecture roster selection, only return lectures this teacher is actually authorized to manage
  if (req.user.role === 'teacher') {
    mapped = mapped.reduce((acc, l) => {
      const access = evaluateTeacherLectureAccess(teacherCtx, l);
      if (access.can_manage) {
        acc.push({
          ...l,
          is_owner: access.is_owner,
          can_manage: true,
          view_only: false,
        });
      }
      return acc;
    }, []);
  } else if (req.user.role === 'admin') {
    mapped = mapped.map((l) => ({ ...l, is_owner: true, can_manage: true, view_only: false }));
  }

  // Filter strictly for student: ONLY own division lectures currently within active attendance window
  if (req.user.role === 'student') {
    const now = new Date();
    mapped = mapped
      .filter((l) => l.division_id === studentDivisionId && isLectureInAttendanceWindow(l, now))
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
  assertActiveAdminOrTeacher(req.user, res);

  const targetDateStr = req.query.date ? getKolkataDateString(req.query.date) : getKolkataDateString();
  const dayName = getKolkataDayName(targetDateStr);

  // Sync timetable for requested date
  try {
    await syncTodayLectures(targetDateStr);
  } catch (err) {
    console.error('Timetable sync error:', err.message);
  }

  let teacherCtx = null;
  if (req.user.role === 'teacher') {
    teacherCtx = await loadTeacherAccessContext(req.user.id, res);
  }
  const currentTeacher = teacherCtx?.teacherRec || null;

  // Fetch all lectures for target date
  const { data: lectures, error } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      division_id,
      subject_id,
      teacher_id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      created_at,
      subject:subjects(id, name, code, division_id),
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

  let myLectures;
  let accessibleLectures;

  if (req.user.role === 'teacher') {
    if (!currentTeacher?.id) {
      myLectures = [];
      accessibleLectures = [];
    } else {
      const evaluated = mapped.map((l) => ({
        item: l,
        access: evaluateTeacherLectureAccess(teacherCtx, l),
      }));
      myLectures = evaluated
        .filter((e) => e.access.can_manage)
        .map((e) => ({
          ...e.item,
          is_owner: e.access.is_owner,
          can_manage: true,
          view_only: false,
        }));
      accessibleLectures = evaluated
        .filter((e) => e.access.visible)
        .map((e) => ({
          ...e.item,
          is_owner: e.access.is_owner,
          can_manage: e.access.can_manage,
          view_only: e.access.view_only,
        }));
    }
  } else if (req.user.role === 'admin') {
    myLectures = mapped.map((l) => ({ ...l, is_owner: true, can_manage: true, view_only: false }));
    accessibleLectures = myLectures;
  } else {
    res.status(403);
    throw new Error('Access Denied: Admin or teacher privileges required');
  }

  // Spotlight own ongoing / upcoming lectures for teachers (never another faculty member's session)
  const ongoing = myLectures.find((l) => l.status === 'ONGOING') || null;
  const nextUpcoming = myLectures.find((l) => l.status === 'UPCOMING') || null;

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
  assertActiveUser(req.user, res);
  const currentDay = getKolkataDayName();
  const currentDate = getKolkataDateString();
  const currentTime = getKolkataTimeString().slice(0, 5);

  res.json({
    success: true,
    data: {
      matrix: SMDL_TIMETABLE_MATRIX,
      current_day: currentDay,
      current_date: currentDate,
      current_time: currentTime,
    },
  });
});

// @desc   Get all scheduled lectures (Admin & Teacher roster)
// @route  GET /api/lectures
const getAllLectures = asyncHandler(async (req, res) => {
  assertActiveAdminOrTeacher(req.user, res);

  let teacherCtx = null;
  if (req.user.role === 'teacher') {
    teacherCtx = await loadTeacherAccessContext(req.user.id, res);
  }

  const { data: lectures, error } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      division_id,
      subject_id,
      teacher_id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      created_at,
      subjects:subjects(id, name, code, division_id),
      divisions:divisions(id, name, division_name),
      teachers:teachers(id, teacher_id, user_id)
    `)
    .order('lecture_date', { ascending: false });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  let mapped = await attachTeacherNames(lectures || []);

  if (req.user?.role === 'teacher') {
    mapped = mapped.reduce((acc, l) => {
      const access = evaluateTeacherLectureAccess(teacherCtx, l);
      if (access.visible) {
        acc.push({
          ...l,
          is_owner: access.is_owner,
          can_manage: access.can_manage,
          view_only: access.view_only,
        });
      }
      return acc;
    }, []);
  } else if (req.user?.role === 'admin') {
    mapped = mapped.map((l) => ({ ...l, is_owner: true, can_manage: true, view_only: false }));
  } else {
    res.status(403);
    throw new Error('Access Denied: Admin or teacher privileges required');
  }

  res.json({
    success: true,
    count: mapped.length,
    data: { lectures: mapped },
  });
});

// @desc   Teacher/Admin creates/starts a new lecture session
// @route  POST /api/lectures
const createLecture = asyncHandler(async (req, res) => {
  assertActiveAdminOrTeacher(req.user, res);
  const { subject_id, division_id, topic, start_time, end_time, lecture_date } = req.body;
  let { teacher_id } = req.body;

  if (!subject_id || !division_id) {
    res.status(400);
    throw new Error('Subject and Division are required');
  }

  // Robust teacher ID resolution & fail-closed teacher ownership enforcement
  let resolvedTeacherId = null;
  let actorTeacherRec = null;

  if (req.user.role === 'teacher') {
    actorTeacherRec = await requireTeacherProfile(req.user, res);
  }

  if (teacher_id) {
    // 1. Direct match on teachers.id (UUID)
    const { data: byId } = await supabaseAdmin
      .from('teachers')
      .select('id, user_id')
      .eq('id', teacher_id)
      .maybeSingle();

    if (byId) {
      resolvedTeacherId = byId.id;
    } else {
      // 2. Match on teachers.user_id (UUID from users table)
      const { data: byUserId } = await supabaseAdmin
        .from('teachers')
        .select('id, user_id')
        .eq('user_id', teacher_id)
        .maybeSingle();

      if (byUserId) {
        resolvedTeacherId = byUserId.id;
      } else {
        // 3. Match on teachers.teacher_id (VARCHAR employee code)
        const { data: byEmpCode } = await supabaseAdmin
          .from('teachers')
          .select('id, user_id')
          .eq('teacher_id', teacher_id)
          .maybeSingle();

        if (byEmpCode) {
          resolvedTeacherId = byEmpCode.id;
        } else {
          res.status(400);
          throw new Error('Teacher record not found. Please verify the selected teacher is active and registered.');
        }
      }
    }

    if (req.user.role === 'teacher' && resolvedTeacherId !== actorTeacherRec.id) {
      res.status(403);
      throw new Error('Access Denied: Teachers cannot create lectures assigned to another faculty member');
    }
  } else if (req.user.role === 'teacher') {
    resolvedTeacherId = actorTeacherRec.id;
  }

  if (!resolvedTeacherId && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Teacher identification is required');
  }

  if (req.user.role === 'teacher') {
    await assertTeacherAuthorizedForSubjectDivision(
      actorTeacherRec.id,
      subject_id,
      division_id,
      res
    );
  }

  const todayStr = lecture_date ? parseValidDateToKolkata(lecture_date, res) : getKolkataDateString();
  const rawStart = start_time || getKolkataTimeString();
  const parsedStart = parseStrictTime(rawStart);
  if (!parsedStart) {
    res.status(400);
    throw new Error('Invalid start_time format. Expected HH:MM or HH:MM:SS');
  }
  const defaultStartTime = parsedStart.formatted;

  let defaultEndTime;
  if (end_time !== undefined && end_time !== null && String(end_time).trim() !== '') {
    const parsedEnd = parseStrictTime(String(end_time));
    if (!parsedEnd) {
      res.status(400);
      throw new Error('Invalid end_time format. Expected HH:MM or HH:MM:SS');
    }
    if (parsedEnd.minutes <= parsedStart.minutes) {
      res.status(400);
      throw new Error('Invalid time range: end_time must be strictly after start_time');
    }
    defaultEndTime = parsedEnd.formatted;
  } else {
    if (parsedStart.minutes >= 23 * 60 + 59) {
      res.status(400);
      throw new Error('Invalid start_time: lecture cannot start at or past 23:59 without end_time');
    }
    const candidateEndMin = parsedStart.minutes + 60;
    if (candidateEndMin > 23 * 60 + 59) {
      res.status(400);
      throw new Error('Invalid start_time: default lecture duration would exceed 23:59; please provide an explicit end_time');
    }
    defaultEndTime = minutesToTimeStr(candidateEndMin);
  }

  // Conflict Resolution: If teacher already has an overlapping lecture on this date,
  // automatically cancel the conflicting lecture and notify students & teacher.
  if (resolvedTeacherId) {
    try {
      const { data: existingLectures } = await supabaseAdmin
        .from('lectures')
        .select('id, start_time, end_time, status, topic, division_id, subject:subjects(name)')
        .eq('teacher_id', resolvedTeacherId)
        .eq('lecture_date', todayStr);

      const toMin = (t) => {
        if (!t) return 0;
        const [h, m] = t.toString().split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const newStartMin = toMin(defaultStartTime);
      const newEndMin = toMin(defaultEndTime);

      const conflicting = (existingLectures || []).filter((lec) => {
        if (isLectureCancelled(lec)) return false;
        const exStartMin = toMin(lec.start_time);
        const exEndMin = toMin(lec.end_time || '23:59:59');
        return exStartMin < newEndMin && exEndMin > newStartMin;
      });

      if (conflicting.length > 0) {
        const conflictingIds = conflicting.map((c) => c.id);
        console.log(`[lectureController] Auto-cancelling ${conflictingIds.length} conflicting lecture(s) for teacher ${resolvedTeacherId}:`, conflictingIds);

        // Mark each conflicting lecture as CANCELLED in DB
        for (const conf of conflicting) {
          const originalTopic = (conf.topic || 'Regular Lecture').replace(/\[(CANCELLED|RESCHEDULED)\]\s*/g, '');
          await supabaseAdmin
            .from('lectures')
            .update({ topic: `[CANCELLED] ${originalTopic}`, status: 'CANCELLED' })
            .eq('id', conf.id);
        }

        // Dispatch cancellation notifications
        const { notifyLectureCancellation } = require('../services/lectureScheduler');
        for (const conf of conflicting) {
          try {
            await notifyLectureCancellation(
              conf.id,
              `Automatically cancelled due to schedule conflict with newly scheduled lecture at ${defaultStartTime.slice(0, 5)}`
            );
          } catch (notifErr) {
            console.warn('[lectureController] Conflict cancel notice error:', notifErr.message);
          }
        }
      }
    } catch (conflictCheckErr) {
      console.warn('[lectureController] Non-blocking conflict check error:', conflictCheckErr.message);
    }
  }

  const insertData = {
    subject_id,
    division_id,
    lecture_date: todayStr,
    start_time: defaultStartTime,
    end_time: defaultEndTime,
    status: 'SCHEDULED',
    topic: topic || 'Regular Lecture',
    created_by: req.user.id,
  };

  if (resolvedTeacherId) {
    insertData.teacher_id = resolvedTeacherId;
  }

  const { data: lecture, error } = await supabaseAdmin
    .from('lectures')
    .insert(insertData)
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name)
    `)
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  // Notify enrolled students in this division about the newly scheduled lecture
  (async () => {
    try {
      const { sendToUsers } = require('../services/notificationService');
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('division_id', division_id);

      const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean);
      if (studentUserIds.length > 0) {
        const subjName = lecture?.subject?.name || topic || 'Class';
        await sendToUsers(studentUserIds, {
          type: 'LECTURE_STARTING',
          title: `New Lecture Scheduled: ${subjName}`,
          message: `${subjName} lecture has been scheduled on ${todayStr} at ${defaultStartTime.slice(0, 5)}.`,
          relatedId: lecture.id,
          relatedType: 'lecture',
          metadata: {
            lecture_id: lecture.id,
            subject_name: subjName,
            start_time: defaultStartTime,
          },
        });
      }
    } catch (notifErr) {
      console.warn('[lectureController] Non-blocking lecture notification error:', notifErr.message);
    }
  })();

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

  const requestedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
  if (!requestedStatus || !VALID_LECTURE_STATUSES.includes(requestedStatus)) {
    res.status(400);
    throw new Error('Invalid lecture status. Allowed values: SCHEDULED, ONGOING, COMPLETED, CANCELLED, RESCHEDULED');
  }
  const normalizedStatus = normalizePersistedStatus(requestedStatus);

  const { data: curr, error: fetchErr } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, subject_id, teacher_id, topic, status, lecture_date, start_time, end_time')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    res.status(500);
    throw new Error(fetchErr.message);
  }
  if (!curr) {
    res.status(404);
    throw new Error('Lecture session not found');
  }

  await assertTeacherCanManageLecture(req.user, curr, res);

  const updatePayload = {
    status: normalizedStatus,
    topic: normalizeTopicForStatus(curr.topic, normalizedStatus, {
      preserveRescheduled: hasExplicitRescheduleProvenance(curr),
    }),
  };

  if (normalizedStatus === 'RESCHEDULED') {
    const newDateInput = req.body.new_date || req.body.lecture_date;
    const newStartInput = req.body.new_time || req.body.start_time;
    const newEndInput = req.body.new_end_time || req.body.end_time;

    if (newDateInput !== undefined && newDateInput !== null && String(newDateInput).trim() !== '') {
      updatePayload.lecture_date = parseValidDateToKolkata(String(newDateInput), res);
    }

    const resolvedTimes = resolveScheduleTimes({
      currentStart: curr.start_time,
      currentEnd: curr.end_time,
      newStartInput,
      newEndInput,
      res,
    });
    updatePayload.start_time = resolvedTimes.start_time;
    updatePayload.end_time = resolvedTimes.end_time;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('lectures')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  // Notify students if lecture was cancelled or rescheduled
  (async () => {
    try {
      const { notifyLectureCancellation, notifyLectureRescheduling } = require('../services/lectureScheduler');
      if (normalizedStatus === 'CANCELLED') {
        await notifyLectureCancellation(id, req.body.reason || 'Class cancelled');
      } else if (normalizedStatus === 'RESCHEDULED') {
        const newTime = req.body.new_time || updated?.start_time || '14:00';
        const newDate = req.body.new_date || updated?.lecture_date || getKolkataDateString();
        await notifyLectureRescheduling(id, newTime, newDate, req.body.reason || 'Timetable updated');
      }
    } catch (notifErr) {
      console.warn('[lectureController] Status notification notice:', notifErr.message);
    }
  })();

  res.json({
    success: true,
    message: `Lecture marked as ${normalizedStatus}`,
    data: { lecture: updated },
  });
});

// @desc   Delete / cancel lecture
// @route  DELETE /api/lectures/:id
const deleteLecture = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: curr, error: fetchErr } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, subject_id, teacher_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    res.status(500);
    throw new Error(fetchErr.message);
  }
  if (!curr) {
    res.status(404);
    throw new Error('Lecture session not found');
  }

  await assertTeacherCanManageLecture(req.user, curr, res);

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
  assertActiveUser(req.user, res);
  if (!['student', 'teacher', 'admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Access Denied: Insufficient permissions');
  }

  const todayStr = getKolkataDateString();
  const dayName = getKolkataDayName();

  // 1. Find student's division strictly from DB profile (never trust student ?division_id=)
  let divisionId = null;
  let studentRecord = null;

  if (req.user.role === 'student') {
    const { data: stu, error: stuErr } = await supabaseAdmin
      .from('students')
      .select('id, student_id, division_id, division:divisions(id, name, division_name)')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (stuErr) {
      console.error('[lectureController] Failed loading student division profile:', stuErr.message);
      res.status(500);
      throw new Error('Failed to load student profile');
    }

    studentRecord = stu;
    divisionId = stu?.division_id || null;

    if (!divisionId) {
      return res.json({
        success: true,
        data: {
          date: todayStr,
          day_name: dayName,
          is_holiday: dayName === 'Sunday',
          classes_count: 0,
          classes: [],
          division_assigned: false,
          source: 'unassigned_division',
        },
      });
    }
  } else {
    divisionId = req.query.division_id || null;
    if (!divisionId) {
      const { data: defaultDiv } = await supabaseAdmin
        .from('divisions')
        .select('id, name')
        .limit(1)
        .maybeSingle();
      divisionId = defaultDiv?.id || null;
    }
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
      .ilike('day_of_week', dayName)
      .order('start_time', { ascending: true });

    if (slotErr && slotErr.code !== '42P01') {
      console.error('[lectureController] Failed loading division_timetables:', slotErr.message);
      res.status(500);
      throw new Error('Failed to load division timetable');
    }

    if (!slotErr && slots && slots.length > 0) {
      isFromTimetable = true;

      // Cross-reference today's persisted lectures deterministically and canonical attendance table
      const { data: todayLectures, error: todayLecErr } = await supabaseAdmin
        .from('lectures')
        .select(`
          id,
          division_id,
          subject_id,
          start_time,
          end_time,
          lecture_date,
          status,
          topic,
          created_at,
          subject:subjects(id, name, code),
          teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name))
        `)
        .eq('division_id', divisionId)
        .eq('lecture_date', todayStr)
        .order('created_at', { ascending: true });

      if (todayLecErr) {
        console.error('[lectureController] Failed loading today lectures for student:', todayLecErr.message);
        res.status(500);
        throw new Error('Failed to load today class schedule');
      }

      const divLectures = (todayLectures || []).filter(
        (l) => l.division_id === divisionId
      );

      const attendanceByLectureId = {};
      if (studentRecord?.id && divLectures.length > 0) {
        const { data: attRows, error: attErr } = await supabaseAdmin
          .from('attendance')
          .select('id, lecture_id, status, marked_at')
          .eq('student_id', studentRecord.id)
          .in('lecture_id', divLectures.map((l) => l.id));

        if (attErr) {
          console.error('[lectureController] Failed loading student attendance rows:', attErr.message);
          res.status(500);
          throw new Error('Failed to load student attendance status');
        }

        (attRows || []).forEach((r) => {
          attendanceByLectureId[r.lecture_id] = r;
        });
      }

      const normHHMM = (t) => String(t || '').trim().slice(0, 5);
      const pickPreferredLecture = (candidates) => {
        if (!candidates || candidates.length === 0) return null;
        return [...candidates].sort((a, b) => {
          const aCan = isLectureCancelled(a) ? 1 : 0;
          const bCan = isLectureCancelled(b) ? 1 : 0;
          if (aCan !== bCan) return aCan - bCan; // Active/replacement before cancelled original
          const aCreated = a.created_at || '';
          const bCreated = b.created_at || '';
          if (aCreated !== bCreated) return bCreated.localeCompare(aCreated); // Latest replacement first
          return String(b.id || '').localeCompare(String(a.id || ''));
        })[0];
      };

      const byTimeAndSubject = new Map();
      for (const l of divLectures) {
        const key = `${normHHMM(l.start_time)}-${l.subject_id}`;
        if (!byTimeAndSubject.has(key)) byTimeAndSubject.set(key, []);
        byTimeAndSubject.get(key).push(l);
      }

      const slotMatches = new Array(slots.length).fill(null);
      const consumedLectureIds = new Set();

      // Pass 1: Match exact (division_id + start_time + subject_id)
      slots.forEach((s, idx) => {
        const key = `${normHHMM(s.start_time)}-${s.subject?.id}`;
        const candidates = byTimeAndSubject.get(key);
        if (candidates && candidates.length > 0) {
          const chosen = pickPreferredLecture(candidates);
          slotMatches[idx] = chosen;
          candidates.forEach((c) => consumedLectureIds.add(c.id));
        }
      });

      const timetableExactKeys = new Set(
        slots
          .filter((s) => s.start_time && s.subject?.id)
          .map((s) => `${normHHMM(s.start_time)}-${s.subject.id}`)
      );

      // Pass 2: Detect unambiguous same-day rescheduled/progressed off-slot lectures for remaining unmatched slots
      const unmatchedSlotCountBySubject = new Map();
      slots.forEach((s, idx) => {
        if (!slotMatches[idx] && s.subject?.id) {
          unmatchedSlotCountBySubject.set(
            s.subject.id,
            (unmatchedSlotCountBySubject.get(s.subject.id) || 0) + 1
          );
        }
      });

      // Only match off-slot lectures that carry explicit reschedule provenance
      // (RESCHEDULED status or [RESCHEDULED] topic tag). Normal manual ONGOING/COMPLETED
      // classes must NEVER be mistaken for a rescheduled timetable slot.
      const unconsumedReschedBySubject = new Map();
      for (const l of divLectures) {
        if (consumedLectureIds.has(l.id) || !hasExplicitRescheduleProvenance(l) || !l.subject_id) continue;
        const exactKey = `${normHHMM(l.start_time)}-${l.subject_id}`;
        if (timetableExactKeys.has(exactKey)) continue;

        if (!unconsumedReschedBySubject.has(l.subject_id)) {
          unconsumedReschedBySubject.set(l.subject_id, []);
        }
        unconsumedReschedBySubject.get(l.subject_id).push(l);
      }

      slots.forEach((s, idx) => {
        if (slotMatches[idx] || !s.subject?.id) return;
        const unmatchedCount = unmatchedSlotCountBySubject.get(s.subject.id) || 0;
        const candidates = unconsumedReschedBySubject.get(s.subject.id) || [];
        if (unmatchedCount === 1 && candidates.length === 1) {
          const chosen = candidates[0];
          slotMatches[idx] = chosen;
          consumedLectureIds.add(chosen.id);
        }
      });

      const now = new Date();
      liveClasses = slots.map((s, idx) => {
        const matchedLecture = slotMatches[idx];
        const att = matchedLecture ? attendanceByLectureId[matchedLecture.id] : null;
        const effectiveStart = matchedLecture?.start_time || s.start_time;
        const effectiveEnd = matchedLecture?.end_time || s.end_time;
        const status = matchedLecture
          ? calculateDynamicStatus(matchedLecture)
          : getSlotStatus(s.start_time, s.end_time, todayStr);
        const canMark = matchedLecture
          ? isLectureInAttendanceWindow(matchedLecture, now)
          : isLectureInAttendanceWindow({ start_time: s.start_time, end_time: s.end_time, lecture_date: todayStr }, now);

        return {
          id: matchedLecture?.id || s.id,
          timetable_id: s.id,
          lecture_id: matchedLecture?.id || null,
          subject_name: s.subject?.name || 'Class',
          subject_code: s.subject?.code || '',
          teacher_name: matchedLecture?.teacher?.user?.full_name || s.teacher?.user?.full_name || 'Assigned Faculty',
          room_number: s.room_number || 'Room 101',
          is_lab: !!s.is_lab,
          start_time: effectiveStart,
          end_time: effectiveEnd,
          status,
          is_attended: att?.status === 'PRESENT',
          attendance_status: att ? att.status : 'NOT_MARKED',
          marked_at: att?.marked_at || null,
          can_mark_attendance: canMark,
          window_expires_at: getWindowExpirationTime(effectiveStart, effectiveEnd),
        };
      });

      // Include any extra/replacement non-cancelled lectures in this division not bound to a slot
      for (const l of divLectures) {
        if (consumedLectureIds.has(l.id) || isLectureCancelled(l)) continue;
        const att = attendanceByLectureId[l.id];
        liveClasses.push({
          id: l.id,
          timetable_id: null,
          lecture_id: l.id,
          subject_name: l.subject?.name || (l.topic || '').replace(/\[(CANCELLED|RESCHEDULED)\]\s*/g, '').trim() || 'Class',
          subject_code: l.subject?.code || '',
          teacher_name: l.teacher?.user?.full_name || 'Assigned Faculty',
          room_number: 'Room 101',
          is_lab: (l.topic || '').toLowerCase().includes('lab') || (l.topic || '').toLowerCase().includes('practical'),
          start_time: l.start_time,
          end_time: l.end_time,
          status: calculateDynamicStatus(l),
          is_attended: att?.status === 'PRESENT',
          attendance_status: att ? att.status : 'NOT_MARKED',
          marked_at: att?.marked_at || null,
          can_mark_attendance: isLectureInAttendanceWindow(l, now),
          window_expires_at: getWindowExpirationTime(l.start_time, l.end_time),
        });
      }

      liveClasses.sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
    }
  }

  // 3. Graceful fallback if division_timetables table not yet migrated or empty for this division
  if (!isFromTimetable && divisionId) {
    try {
      await syncTodayLectures(todayStr);
    } catch (_e) {}

    const { data: lectures, error: fallbackLecErr } = await supabaseAdmin
      .from('lectures')
      .select(`
        id,
        lecture_date,
        start_time,
        end_time,
        status,
        topic,
        subject:subjects(id, name, code),
        teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name))
      `)
      .eq('lecture_date', todayStr)
      .eq('division_id', divisionId)
      .order('start_time', { ascending: true });

    if (fallbackLecErr) {
      console.error('[lectureController] Failed loading fallback daily lectures:', fallbackLecErr.message);
      res.status(500);
      throw new Error('Failed to load today class schedule');
    }

    if (lectures && lectures.length > 0) {
      let attMap = {};
      if (studentRecord?.id) {
        const { data: att, error: fallbackAttErr } = await supabaseAdmin
          .from('attendance')
          .select('id, lecture_id, status, marked_at')
          .eq('student_id', studentRecord.id)
          .in('lecture_id', lectures.map((l) => l.id));

        if (fallbackAttErr) {
          console.error('[lectureController] Failed loading fallback attendance:', fallbackAttErr.message);
          res.status(500);
          throw new Error('Failed to load student attendance status');
        }

        (att || []).forEach((a) => {
          attMap[a.lecture_id] = a;
        });
      }

      const now = new Date();
      liveClasses = lectures.map((l) => {
        const status = calculateDynamicStatus(l);
        const att = attMap[l.id];
        const canMark = isLectureInAttendanceWindow(l, now);
        return {
          id: l.id,
          timetable_id: l.id,
          subject_name: l.subject?.name || (l.topic || '').replace(/\[(CANCELLED|RESCHEDULED)\]\s*/g, '').trim() || 'Class',
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

// @desc   Admin / Teacher updates an existing lecture (Proxy teacher, subject change, reschedule)
// @route  PUT /api/lectures/:id
const updateLecture = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subject_id, division_id, topic, start_time, end_time, lecture_date, reason } = req.body;
  let { teacher_id } = req.body;

  // 1. Fetch current lecture
  const { data: currentLecture, error: fetchErr } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      division_id,
      subject_id,
      teacher_id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name),
      teacher:teachers(id, teacher_id, user_id)
    `)
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    res.status(500);
    throw new Error(fetchErr.message);
  }
  if (!currentLecture) {
    res.status(404);
    throw new Error('Lecture session not found');
  }

  const actorTeacherRec = await assertTeacherCanManageLecture(req.user, currentLecture, res);

  // 2. Resolve teacher_id if provided
  let resolvedTeacherId = currentLecture.teacher_id;
  let teacherChanged = false;

  if (teacher_id !== undefined && teacher_id !== null && teacher_id !== '') {
    // 2.1 Match by teachers.id
    const { data: byId } = await supabaseAdmin
      .from('teachers')
      .select('id, user_id, teacher_id')
      .eq('id', teacher_id)
      .maybeSingle();

    if (byId) {
      resolvedTeacherId = byId.id;
    } else {
      // 2.2 Match by teachers.user_id
      const { data: byUserId } = await supabaseAdmin
        .from('teachers')
        .select('id, user_id, teacher_id')
        .eq('user_id', teacher_id)
        .maybeSingle();

      if (byUserId) {
        resolvedTeacherId = byUserId.id;
      } else {
        // 2.3 Match by employee code
        const { data: byEmpCode } = await supabaseAdmin
          .from('teachers')
          .select('id, user_id, teacher_id')
          .eq('teacher_id', teacher_id)
          .maybeSingle();

        if (byEmpCode) {
          resolvedTeacherId = byEmpCode.id;
        } else {
          res.status(400);
          throw new Error('Specified teacher record was not found.');
        }
      }
    }

    if (req.user.role === 'teacher' && resolvedTeacherId !== actorTeacherRec.id) {
      res.status(403);
      throw new Error('Access Denied: Teachers cannot transfer lectures to another faculty member');
    }

    if (resolvedTeacherId !== currentLecture.teacher_id) {
      teacherChanged = true;
    }
  }

  const effectiveDivisionId = division_id || currentLecture.division_id;
  const effectiveSubjectId = subject_id || currentLecture.subject_id;
  if (
    req.user.role === 'teacher' &&
    (effectiveSubjectId !== currentLecture.subject_id || effectiveDivisionId !== currentLecture.division_id)
  ) {
    await assertTeacherAuthorizedForSubjectDivision(
      actorTeacherRec.id,
      effectiveSubjectId,
      effectiveDivisionId,
      res
    );
  }
  const effectiveDate =
    lecture_date !== undefined && lecture_date !== null && String(lecture_date).trim() !== ''
      ? parseValidDateToKolkata(String(lecture_date), res)
      : currentLecture.lecture_date;

  const resolvedTimes = resolveScheduleTimes({
    currentStart: currentLecture.start_time,
    currentEnd: currentLecture.end_time,
    newStartInput: start_time,
    newEndInput: end_time,
    res,
  });
  const effectiveStartTime = resolvedTimes.start_time;
  const effectiveEndTime = resolvedTimes.end_time;
  const effectiveTopic = topic !== undefined ? topic : currentLecture.topic;

  // 3. Conflict Resolution for the new teacher (if teacher or timing changed)
  if (resolvedTeacherId && (teacherChanged || start_time || end_time || lecture_date)) {
    try {
      const { data: existingLectures, error: confErr } = await supabaseAdmin
        .from('lectures')
        .select('id, start_time, end_time, status, topic, division_id, subject:subjects(name)')
        .eq('teacher_id', resolvedTeacherId)
        .eq('lecture_date', effectiveDate)
        .neq('id', id);

      if (confErr) {
        console.warn('[lectureController] Conflict lookup warning:', confErr.message);
      } else {
        const toMin = (t) => {
          if (!t) return 0;
          const [h, m] = t.toString().split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };

        const newStartMin = toMin(effectiveStartTime);
        const newEndMin = toMin(effectiveEndTime);

        const conflicting = (existingLectures || []).filter((lec) => {
          if (isLectureCancelled(lec)) return false;
          const exStartMin = toMin(lec.start_time);
          const exEndMin = toMin(lec.end_time || '23:59:59');
          return exStartMin < newEndMin && exEndMin > newStartMin;
        });

        if (conflicting.length > 0) {
          const conflictingIds = conflicting.map((c) => c.id);
          console.log(`[lectureController] Auto-cancelling ${conflictingIds.length} conflicting lecture(s) for substitute teacher ${resolvedTeacherId}:`, conflictingIds);

          for (const conf of conflicting) {
            await supabaseAdmin
              .from('lectures')
              .update({
                topic: normalizeTopicForStatus(conf.topic || 'Regular Lecture', 'CANCELLED'),
                status: 'CANCELLED',
              })
              .eq('id', conf.id);
          }

          const { notifyLectureCancellation } = require('../services/lectureScheduler');
          for (const conf of conflicting) {
            try {
              await notifyLectureCancellation(
                conf.id,
                `Automatically cancelled due to proxy schedule conflict at ${effectiveStartTime.slice(0, 5)}`
              );
            } catch (_e) {}
          }
        }
      }
    } catch (cErr) {
      console.warn('[lectureController] Non-blocking conflict check warning:', cErr.message);
    }
  }

  const normTimeForCompare = (val) => {
    const parsed = parseStrictTime(String(val || ''));
    return parsed ? parsed.formatted : String(val || '').trim();
  };
  const normDateForCompare = (val) => String(val || '').trim().slice(0, 10);

  const scheduleChanged = Boolean(
    (lecture_date !== undefined && lecture_date !== null && String(lecture_date).trim() !== '' &&
      normDateForCompare(effectiveDate) !== normDateForCompare(currentLecture.lecture_date)) ||
    (start_time !== undefined && start_time !== null && String(start_time).trim() !== '' &&
      normTimeForCompare(effectiveStartTime) !== normTimeForCompare(currentLecture.start_time)) ||
    (end_time !== undefined && end_time !== null && String(end_time).trim() !== '' &&
      normTimeForCompare(effectiveEndTime) !== normTimeForCompare(currentLecture.end_time))
  );
  const reqStatusUpper = typeof req.body.status === 'string' ? req.body.status.trim().toUpperCase() : '';
  if (reqStatusUpper && !VALID_LECTURE_STATUSES.includes(reqStatusUpper)) {
    res.status(400);
    throw new Error('Invalid lecture status');
  }
  const resolvedStatus = reqStatusUpper
    ? normalizePersistedStatus(reqStatusUpper)
    : scheduleChanged && !isLectureCancelled(currentLecture)
      ? 'RESCHEDULED'
      : normalizePersistedStatus(currentLecture.status);

  // 4. Update the lecture record
  const updatePayload = {
    subject_id: effectiveSubjectId,
    teacher_id: resolvedTeacherId,
    division_id: effectiveDivisionId,
    lecture_date: effectiveDate,
    start_time: effectiveStartTime,
    end_time: effectiveEndTime,
    status: resolvedStatus,
    topic: normalizeTopicForStatus(effectiveTopic, resolvedStatus, {
      preserveRescheduled: hasExplicitRescheduleProvenance(currentLecture),
    }),
  };

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('lectures')
    .update(updatePayload)
    .eq('id', id)
    .select(`
      id,
      lecture_date,
      start_time,
      end_time,
      status,
      topic,
      subject:subjects(id, name, code),
      division:divisions(id, name, division_name),
      teacher:teachers(id, teacher_id, user_id)
    `)
    .single();

  if (updErr) {
    res.status(500);
    throw new Error(updErr.message);
  }

  const [mappedLecture] = await attachTeacherNames([updated]);

  // 5. Send Notification to all students in division & affected faculty
  (async () => {
    try {
      const { sendToUsers } = require('../services/notificationService');
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('division_id', effectiveDivisionId);

      const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean);
      const recipientIds = [...new Set([
        ...studentUserIds,
        currentLecture.teacher?.user_id,
        updated.teacher?.user_id,
      ].filter(Boolean))];

      if (recipientIds.length > 0) {
        const subjName = mappedLecture?.subject?.name || 'Class';
        const teacherName = mappedLecture?.teacher?.full_name || 'Faculty';
        const formattedTime = effectiveStartTime.slice(0, 5);

        let notifTitle = `Lecture Updated: ${subjName}`;
        let notifMessage = `Today's ${subjName} lecture (${formattedTime}) has been updated. Faculty: ${teacherName}.`;

        if (teacherChanged) {
          notifTitle = `Faculty Update (Proxy): ${subjName}`;
          notifMessage = `Notice: Today's ${subjName} lecture at ${formattedTime} will now be conducted by ${teacherName} (Substitute faculty). ${reason ? `Note: ${reason}` : ''}`;
        } else if (subject_id && subject_id !== currentLecture.subject_id) {
          notifTitle = `Subject Updated: ${subjName}`;
          notifMessage = `Notice: Lecture at ${formattedTime} is now scheduled for ${subjName} with ${teacherName}. ${reason ? `Note: ${reason}` : ''}`;
        }

        await sendToUsers(recipientIds, {
          type: 'LECTURE_RESCHEDULED',
          title: notifTitle,
          message: notifMessage,
          relatedId: id,
          relatedType: 'lecture',
          metadata: {
            lecture_id: id,
            subject_name: subjName,
            teacher_name: teacherName,
            is_proxy: teacherChanged,
            new_date: effectiveDate,
            new_time: effectiveStartTime,
            reason: reason || null,
          },
        });
      }
    } catch (notifErr) {
      console.warn('[lectureController] Non-blocking update notification error:', notifErr.message);
    }
  })();

  res.json({
    success: true,
    message: teacherChanged
      ? `Lecture successfully transferred to substitute faculty (${mappedLecture?.teacher?.full_name || 'Teacher'}) and students notified!`
      : 'Lecture details updated successfully and students notified!',
    data: { lecture: mappedLecture },
  });
});

module.exports = {
  getActiveLectures,
  getAllLectures,
  createLecture,
  updateLecture,
  updateLectureStatus,
  deleteLecture,
  getTodaySchedule,
  getTimetableMatrix,
  getStudentTodayClasses,
  assertActiveAdminOrTeacher,
  assertTeacherAuthorizedForSubjectDivision,
  assertTeacherCanManageLecture,
  loadTeacherAccessContext,
  evaluateTeacherLectureAccess,
};


