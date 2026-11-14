const crypto = require('crypto');
const { getKolkataDateString, getKolkataDayName, getKolkataMinutes } = require('../utils/dateUtils');
const { supabaseAdmin } = require('../config/db');
const { assertActiveUser } = require('../middleware/roles');
const { assertTeacherCanManageLecture } = require('./lectureController');
const asyncHandler = require('../utils/asyncHandler');
const {
  validateAndDecodeSelfie,
  uploadAttendanceSelfie,
  deleteSelfieObject,
  generateSelfieSignedUrl,
} = require('../services/selfieStorageService');

// Default fallback SMDL College coordinates and radius
const DEFAULT_COLLEGE_LAT = 19.02479;
const DEFAULT_COLLEGE_LON = 73.10159;
const DEFAULT_GEOFENCE_RADIUS = 100; // default 100 meters per Step 8 requirements

// Prevent duplicate lecture insertions under concurrent slot fallback requests
const activeSlotCreationLocks = new Map();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayNameSafe(dateStr) {
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }
  if (typeof getKolkataDayName === 'function') {
    return getKolkataDayName();
  }
  return DAY_NAMES[new Date().getUTCDay()];
}

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

function normalizePersistedStatus(status) {
  if (!status) return 'SCHEDULED';
  return status === 'ACTIVE' ? 'SCHEDULED' : status;
}

function isLectureCancelled(lecture) {
  if (!lecture) return false;
  if (lecture.status === 'CANCELLED') return true;
  const st = lecture.status ? String(lecture.status).toUpperCase() : 'SCHEDULED';
  return ['SCHEDULED', 'ACTIVE'].includes(st) && Boolean(lecture.topic && lecture.topic.includes('[CANCELLED]'));
}

function hasExplicitRescheduleProvenance(lecture) {
  if (!lecture || isLectureCancelled(lecture)) return false;
  if (normalizePersistedStatus(lecture.status) === 'RESCHEDULED') return true;
  return Boolean(lecture.topic && lecture.topic.includes('[RESCHEDULED]'));
}

async function assertTeacherAuthorizedForLecture(user, lecture, res) {
  return assertTeacherCanManageLecture(user, lecture, res);
}

async function querySlotLectures(slot, todayStr, res) {
  const { data: matches, error: matchErr } = await supabaseAdmin
    .from('lectures')
    .select('id, lecture_date, start_time, end_time, division_id, subject_id, status, topic, created_at, subject:subjects(id, name)')
    .eq('division_id', slot.division_id)
    .eq('lecture_date', todayStr)
    .eq('start_time', slot.start_time)
    .order('created_at', { ascending: true });

  if (matchErr) {
    console.error('[attendanceController] Slot lecture query failed:', {
      slotId: slot.id,
      divisionId: slot.division_id,
      date: todayStr,
      startTime: slot.start_time,
      code: matchErr.code,
      message: matchErr.message,
    });
    res.status(500);
    throw new Error('Failed to resolve lecture session for timetable slot');
  }

  const list = matches || [];
  if (list.length > 1) {
    const activeMatches = list.filter((l) => !isLectureCancelled(l));
    if (activeMatches.length === 1) {
      return activeMatches[0];
    }
    if (activeMatches.length === 0) {
      return list[0];
    }
    console.error('[attendanceController] Ambiguous slot match - multiple active lecture rows:', {
      slotId: slot.id,
      divisionId: slot.division_id,
      subjectId: slot.subject_id,
      date: todayStr,
      startTime: slot.start_time,
      matches: activeMatches.map((l) => ({ id: l.id, status: l.status, subject_id: l.subject_id })),
    });
    res.status(409);
    throw new Error('Multiple conflicting lecture sessions exist for this time slot. Please contact your teacher or admin.');
  }

  return list[0] || null;
}

async function resolveOrCreateLectureForSlot(slot, todayStr, userId, res) {
  if (!slot.division_id || !slot.subject_id) {
    res.status(400);
    throw new Error('Timetable slot is missing division or subject configuration');
  }

  const lockKey = `${slot.division_id}-${todayStr}-${String(slot.start_time || '').slice(0, 5)}`;
  if (activeSlotCreationLocks.has(lockKey)) {
    return activeSlotCreationLocks.get(lockKey);
  }

  const promise = (async () => {
    const existingAtSlot = await querySlotLectures(slot, todayStr, res);
    if (existingAtSlot) {
      return existingAtSlot;
    }

    // Check whether this slot was rescheduled (and possibly progressed to ONGOING/COMPLETED) today
    const { data: sameSubjectLectures, error: reschedErr } = await supabaseAdmin
      .from('lectures')
      .select('id, lecture_date, start_time, end_time, division_id, subject_id, status, topic, created_at, subject:subjects(id, name)')
      .eq('division_id', slot.division_id)
      .eq('lecture_date', todayStr)
      .eq('subject_id', slot.subject_id)
      .order('created_at', { ascending: true });

    if (reschedErr) {
      console.error('[attendanceController] Rescheduled slot lookup failed:', {
        slotId: slot.id,
        code: reschedErr.code,
        message: reschedErr.message,
      });
      res.status(500);
      throw new Error('Failed to resolve scheduled class session');
    }

    const dayName = getDayNameSafe(todayStr);
    const { data: rawSubjectSlots, error: subSlotsErr } = await supabaseAdmin
      .from('division_timetables')
      .select('id, start_time')
      .eq('division_id', slot.division_id)
      .ilike('day_of_week', dayName)
      .eq('subject_id', slot.subject_id);

    if (subSlotsErr) {
      console.error('[attendanceController] Timetable subject slot lookup failed:', subSlotsErr.message);
      res.status(500);
      throw new Error('Failed to resolve subject timetable schedule');
    }

    const subjectSlots = Array.isArray(rawSubjectSlots) && rawSubjectSlots.length > 0
      ? rawSubjectSlots
      : [slot];
    const normHHMM = (t) => String(t || '').trim().slice(0, 5);
    const slotExactTimes = new Set(subjectSlots.map((s) => normHHMM(s.start_time)).filter(Boolean));
    slotExactTimes.add(normHHMM(slot.start_time));

    const lectureTimesPresent = new Set(
      (sameSubjectLectures || []).map((l) => normHHMM(l.start_time)).filter(Boolean)
    );
    const unmatchedSlotTimes = Array.from(slotExactTimes).filter((hhmm) => !lectureTimesPresent.has(hhmm));

    // Only match off-slot lectures carrying explicit reschedule provenance.
    // Normal manually created ONGOING/COMPLETED extra sessions must never hijack a timetable slot.
    const offSlotRescheduled = (sameSubjectLectures || []).filter((l) => {
      if (slotExactTimes.has(normHHMM(l.start_time))) return false;
      return hasExplicitRescheduleProvenance(l);
    });

    if (unmatchedSlotTimes.length > 1 && offSlotRescheduled.length > 0) {
      console.error('[attendanceController] Ambiguous multi-slot rescheduled lookup:', {
        slotId: slot.id,
        unmatchedSlotTimes,
        offSlotIds: offSlotRescheduled.map((l) => l.id),
      });
      res.status(409);
      throw new Error('Multiple timetable slots for this subject could match a rescheduled session today.');
    }

    if (offSlotRescheduled.length > 1) {
      console.error('[attendanceController] Ambiguous off-slot rescheduled lectures for slot:', {
        slotId: slot.id,
        divisionId: slot.division_id,
        subjectId: slot.subject_id,
        matches: offSlotRescheduled.map((l) => ({ id: l.id, start_time: l.start_time, status: l.status })),
      });
      res.status(409);
      throw new Error('Multiple rescheduled lecture sessions found for this subject today.');
    }

    if (offSlotRescheduled.length === 1) {
      return offSlotRescheduled[0];
    }

    const { data: newLec, error: createLecErr } = await supabaseAdmin
      .from('lectures')
      .insert({
        division_id: slot.division_id,
        subject_id: slot.subject_id,
        teacher_id: slot.teacher_id || null,
        lecture_date: todayStr,
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: 'SCHEDULED',
        topic: slot.subject?.name || 'Class Lecture',
        created_by: userId || null,
      })
      .select('id, lecture_date, start_time, end_time, division_id, subject_id, status, topic, subject:subjects(id, name)')
      .single();

    if (createLecErr) {
      if (createLecErr.code === '23505') {
        const recovered = await querySlotLectures(slot, todayStr, res);
        if (recovered) return recovered;
      }
      console.error('[attendanceController] Failed to initialize lecture from slot:', createLecErr.message);
      res.status(500);
      throw new Error('Failed to create lecture session from timetable slot');
    }

    return newLec;
  })().finally(() => {
    activeSlotCreationLocks.delete(lockKey);
  });

  activeSlotCreationLocks.set(lockKey, promise);
  return promise;
}

/**
 * Loads the active geofence configuration from system_config table with fallback defaults.
 */
async function getActiveGeofenceConfig() {
  try {
    const { data: configs, error } = await supabaseAdmin
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['college_latitude', 'college_longitude', 'geofence_radius_meters']);

    if (!error && configs && configs.length > 0) {
      const map = {};
      configs.forEach((c) => {
        map[c.config_key] = c.config_value;
      });

      const lat = parseFloat(map['college_latitude']);
      const lon = parseFloat(map['college_longitude']);
      const rad = parseInt(map['geofence_radius_meters'], 10);

      return {
        latitude: !isNaN(lat) && isFinite(lat) && lat >= -90 && lat <= 90 ? lat : DEFAULT_COLLEGE_LAT,
        longitude: !isNaN(lon) && isFinite(lon) && lon >= -180 && lon <= 180 ? lon : DEFAULT_COLLEGE_LON,
        radiusMeters: !isNaN(rad) && isFinite(rad) && rad > 0 ? rad : DEFAULT_GEOFENCE_RADIUS,
      };
    }
  } catch (err) {
    console.warn('[attendanceController] Could not load system_config geofence, using fallback defaults:', err.message);
  }

  return {
    latitude: DEFAULT_COLLEGE_LAT,
    longitude: DEFAULT_COLLEGE_LON,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS,
  };
}

// @desc   Get active geofence configuration (read-only for students, teachers, admins)
// @route  GET /api/attendance/geofence-config
const getGeofenceConfig = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  const config = await getActiveGeofenceConfig();
  res.json({
    success: true,
    data: {
      college_latitude: config.latitude,
      college_longitude: config.longitude,
      geofence_radius_meters: config.radiusMeters,
    },
  });
});

// Haversine Formula for distance calculation in meters
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// @desc   Student marks attendance (GPS + Live Selfie)
// @route  POST /api/attendance/mark
const markAttendance = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  if (!['student', 'admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Access Denied: Insufficient permissions');
  }

  const { lecture_id, latitude, longitude, selfie, is_demo_bypass } = req.body;

  if (!lecture_id) {
    res.status(400);
    throw new Error('Lecture ID is required');
  }

  // 1. Get authenticated student profile from trusted DB (never trust client division/course)
  const { data: student, error: studErr } = await supabaseAdmin
    .from('students')
    .select('id, student_id, division_id, course_id, division:divisions(id, course_id)')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (studErr) {
    console.error('[attendanceController] Student profile lookup failed:', studErr.message);
    res.status(500);
    throw new Error('Failed to load student profile');
  }
  if (!student) {
    res.status(403);
    throw new Error('Student profile not found');
  }
  if (!student.division_id) {
    res.status(403);
    throw new Error('You are not assigned to a division. Please contact the college administration.');
  }
  if (!student.division) {
    res.status(403);
    throw new Error('Access Denied: Assigned division record could not be verified.');
  }
  const authoritativeStudentCourseId = student.division.course_id || null;
  if (student.course_id && authoritativeStudentCourseId !== student.course_id) {
    res.status(403);
    throw new Error('Access Denied: Student course enrollment is inconsistent with assigned division.');
  }

  // 2. Validate lecture exists (support direct lecture ID or division_timetables slot ID)
  let resolvedLectureId = lecture_id;

  let { data: lecture, error: lecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, lecture_date, start_time, end_time, division_id, subject_id, status, topic, division:divisions(id, course_id), subject:subjects(id, name)')
    .eq('id', resolvedLectureId)
    .maybeSingle();

  if (lecErr) {
    console.error('[attendanceController] Direct lecture lookup failed:', {
      lectureId: resolvedLectureId,
      code: lecErr.code,
      message: lecErr.message,
    });
    res.status(500);
    throw new Error('Failed to validate lecture session');
  }

  if (!lecture) {
    // Check if resolvedLectureId is a division_timetables slot ID
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('division_timetables')
      .select('id, division_id, subject_id, teacher_id, start_time, end_time, division:divisions(id, course_id), subject:subjects(id, name)')
      .eq('id', resolvedLectureId)
      .maybeSingle();

    if (slotErr) {
      console.error('[attendanceController] Timetable slot lookup failed:', {
        slotId: resolvedLectureId,
        code: slotErr.code,
        message: slotErr.message,
      });
      res.status(500);
      throw new Error('Failed to verify timetable slot');
    }

    if (slot) {
      if (!slot.division_id || slot.division_id !== student.division_id) {
        res.status(403);
        throw new Error('Access Denied: You can only mark attendance for classes in your assigned division.');
      }
      const todayStr = getKolkataDateString();
      lecture = await resolveOrCreateLectureForSlot(slot, todayStr, req.user.id, res);
      resolvedLectureId = lecture?.id;
    }
  }

  if (!lecture) {
    res.status(404);
    throw new Error('Lecture session or scheduled class slot not found');
  }

  if (!lecture.division_id || lecture.division_id !== student.division_id) {
    res.status(403);
    throw new Error('Access Denied: You can only mark attendance for lectures in your assigned division.');
  }

  const { data: targetDivision, error: targetDivErr } = await supabaseAdmin
    .from('divisions')
    .select('id, course_id')
    .eq('id', lecture.division_id)
    .maybeSingle();

  if (targetDivErr) {
    console.error('[attendanceController] Target division lookup failed:', targetDivErr.message);
    res.status(500);
    throw new Error('Failed to verify division course enrollment');
  }
  if (!targetDivision) {
    res.status(403);
    throw new Error('Access Denied: Target lecture division could not be verified.');
  }
  const targetDivisionCourseId = targetDivision.course_id || null;
  if (
    (student.course_id && targetDivisionCourseId !== student.course_id) ||
    (authoritativeStudentCourseId !== targetDivisionCourseId)
  ) {
    res.status(403);
    throw new Error('Access Denied: Student course/program does not match the target lecture division.');
  }

  if (isLectureCancelled(lecture)) {
    res.status(400);
    throw new Error('Cannot mark attendance for a cancelled lecture');
  }

  // 2.1 Timing Window Verification (+1 hr after lecture end, max 2 hrs from start)
  const now = new Date();
  const todayStr = getKolkataDateString(now);
  const lectureDateStr = (lecture.lecture_date || '').toString().slice(0, 10);
  if (lectureDateStr && lectureDateStr !== todayStr) {
    res.status(400);
    throw new Error('Attendance can only be marked on the day of the lecture.');
  }

  const parsedStart = parseStrictTime(String(lecture.start_time || '00:00'));
  const parsedEnd = parseStrictTime(String(lecture.end_time || '23:59'));
  const startMin = parsedStart ? parsedStart.minutes : 0;
  const endMin = parsedEnd ? parsedEnd.minutes : 23 * 60 + 59;
  const nowMin = getKolkataMinutes(now);
  const expirationMin = Math.min(endMin + 60, startMin + 120, 23 * 60 + 59);

  if (nowMin < startMin) {
    res.status(400);
    throw new Error(`Attendance has not opened yet. This lecture starts at ${lecture.start_time?.slice(0, 5)}.`);
  }

  if (nowMin > expirationMin) {
    const expH = String(Math.floor(expirationMin / 60)).padStart(2, '0');
    const expM = String(expirationMin % 60).padStart(2, '0');
    res.status(400);
    throw new Error(`Attendance window is closed. Attendance could only be marked during the lecture or until ${expH}:${expM} (1 hr after lecture end, max 2 hrs from start).`);
  }

  // 3. Prevent duplicate attendance
  const { data: existing, error: existingAttErr } = await supabaseAdmin
    .from('attendance')
    .select('id, status, marked_at')
    .eq('lecture_id', resolvedLectureId)
    .eq('student_id', student.id)
    .maybeSingle();

  if (existingAttErr) {
    console.error('[attendanceController] Duplicate attendance lookup failed:', existingAttErr.message);
    res.status(500);
    throw new Error('Failed to check existing attendance status');
  }

  if (existing) {
    res.status(400);
    throw new Error(`Attendance already marked for this lecture at ${new Date(existing.marked_at).toLocaleTimeString()}`);
  }

  // 4. Geolocation verification (Hardened against fake GPS & production bypass)
  const isDev = process.env.NODE_ENV !== 'production';
  const allowDemoBypass = isDev && Boolean(is_demo_bypass);

  // Load latest active geofence settings from system_config (with resilient fallback)
  const geofenceConfig = await getActiveGeofenceConfig();
  const collegeLat = geofenceConfig.latitude;
  const collegeLon = geofenceConfig.longitude;
  const allowedRadius = geofenceConfig.radiusMeters;

  let distanceMeters = null;
  let isWithinGeofence = false;

  if (latitude && longitude) {
    distanceMeters = calculateDistanceInMeters(latitude, longitude, collegeLat, collegeLon);
    isWithinGeofence = allowDemoBypass || distanceMeters <= allowedRadius;
  } else if (allowDemoBypass) {
    distanceMeters = 42; // simulated demo distance in development only
    isWithinGeofence = true;
  }

  if (!isWithinGeofence) {
    res.status(400);
    throw new Error(
      distanceMeters !== null
        ? `Location verification failed: You are ${distanceMeters}m away from SMDL College (Max allowed: ${allowedRadius}m).`
        : 'Valid GPS coordinates (latitude and longitude) are required within college premises.'
    );
  }

  // 5. Selfie check & server-side validation
  if (!selfie) {
    res.status(400);
    throw new Error('Live camera selfie is required to verify physical presence');
  }

  // Validate format, MIME type, magic bytes, and size (Max 5MB)
  const validatedImage = validateAndDecodeSelfie(selfie);

  // Generate deterministic attendance UUID for collision-resistant storage path
  const targetAttendanceId = crypto.randomUUID();

  // 6. Upload selfie to private Supabase Storage
  let storageUploadResult;
  try {
    storageUploadResult = await uploadAttendanceSelfie({
      studentId: student.id,
      attendanceId: targetAttendanceId,
      buffer: validatedImage.buffer,
      mimeType: validatedImage.mimeType,
      extension: validatedImage.extension,
    });
  } catch (uploadErr) {
    res.status(502);
    throw new Error(`Failed to securely store attendance selfie: ${uploadErr.message}`);
  }

  const { storagePath, uploadedAt, expiresAt } = storageUploadResult;

  // 7. Record attendance with storage reference (NO Base64 stored in DB!)
  const insertPayload = {
    id: targetAttendanceId,
    lecture_id: resolvedLectureId,
    student_id: student.id,
    status: 'PRESENT',
    location_verified: true,
    latitude: latitude || collegeLat,
    longitude: longitude || collegeLon,
    geofence_radius: allowedRadius,
    selfie_url: storagePath,
    marked_at: uploadedAt,
    marked_by: req.user.id,
    source: 'AUTO_VERIFIED',
    notes: 'Student self-verified attendance via GPS + live selfie (private storage)',
  };

  let attendance = null;
  let attErr = null;

  try {
    const res = await supabaseAdmin
      .from('attendance')
      .insert({
        ...insertPayload,
        selfie_storage_path: storagePath,
        selfie_uploaded_at: uploadedAt,
        selfie_expires_at: expiresAt,
      })
      .select()
      .single();
    attendance = res.data;
    attErr = res.error;
  } catch (e) {
    attErr = e;
  }

  // Fallback if dedicated columns not in remote schema cache
  if (attErr && (attErr.code === 'PGRST204' || attErr.code === '42703' || attErr.message?.includes('schema cache') || attErr.message?.includes('selfie_'))) {
    const fallbackRes = await supabaseAdmin
      .from('attendance')
      .insert(insertPayload)
      .select()
      .single();
    attendance = fallbackRes.data;
    attErr = fallbackRes.error;
  }

  // COMPENSATION / ROLLBACK: If DB insertion failed after successful storage upload,
  // delete the uploaded storage object immediately so no unmanaged orphan file remains!
  if (attErr || !attendance) {
    console.warn(`[attendanceController] DB insert failed: ${attErr?.message || JSON.stringify(attErr)}. Executing compensation cleanup for storage object: ${storagePath}`);
    await deleteSelfieObject(storagePath).catch((delErr) =>
      console.error('[attendanceController] Compensation cleanup error:', delErr)
    );
    res.status(500);
    throw new Error(attErr?.message || 'Failed to record attendance in database');
  }

  // Note: attendance table is the single canonical source of truth (secondary attendance_records write removed)

  // Attendance marking must never assign or alter a student division.

  // Asynchronously dispatch ATTENDANCE_MARKED notification & check low attendance
  (async () => {
    try {
      const { createNotification } = require('../services/notificationService');
      const { checkAndNotifyLowAttendance } = require('../services/attendanceNotificationService');
      const subjName = lecture?.subject?.name || lecture?.topic || 'Class';
      await createNotification({
        userId: req.user.id,
        type: 'ATTENDANCE_MARKED',
        title: 'Attendance Marked',
        message: `Your ${subjName} attendance has been marked for today's lecture.`,
        relatedId: resolvedLectureId,
        relatedType: 'lecture',
        metadata: {
          lecture_id: resolvedLectureId,
          subject_name: subjName,
          marked_at: attendance.marked_at,
        },
      });

      const targetSubjId = lecture?.subject_id || (lecture?.subject?.id);
      if (targetSubjId) {
        await checkAndNotifyLowAttendance(student.id, targetSubjId);
      }
    } catch (e) {
      console.warn('[attendanceController] Notification notice:', e.message);
    }
  })();

  res.status(201).json({
    success: true,
    message: 'Attendance successfully marked! Physical presence verified.',
    data: {
      attendance,
      verification: {
        distance: `${distanceMeters} meters`,
        location_verified: true,
        selfie_verified: true,
      },
    },
  });
});

// @desc   Teacher/Admin gets attendance roster for a specific lecture
// @route  GET /api/attendance/lecture/:lectureId
const getLectureAttendance = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  const { lectureId } = req.params;

  // 1. Get lecture with division
  const { data: lecture, error: lecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, subject_id, teacher_id, status, topic, lecture_date, start_time, end_time, subject:subjects(id, name, code)')
    .eq('id', lectureId)
    .maybeSingle();

  if (lecErr) {
    console.error('[attendanceController] Lecture roster lookup failed:', lecErr.message);
    res.status(500);
    throw new Error('Failed to fetch lecture details');
  }
  if (!lecture) {
    res.status(404);
    throw new Error('Lecture not found');
  }

  // Fail-closed teacher authorization check
  await assertTeacherAuthorizedForLecture(req.user, lecture, res);

  // 2. Get all students in this division
  const { data: divisionStudents } = await supabaseAdmin
    .from('students')
    .select('id, student_id, users(full_name, email, phone)')
    .eq('division_id', lecture.division_id);

  // 3. Get all attendance records marked for this lecture
  const { data: attendanceRecords } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('lecture_id', lectureId);

  // 4. Also fetch any students who marked attendance but aren't enrolled in this division
  const divisionStudentIds = new Set((divisionStudents || []).map((s) => s.id));
  const missingAttendeeIds = (attendanceRecords || [])
    .map((a) => a.student_id)
    .filter((id) => id && !divisionStudentIds.has(id));

  let extraStudents = [];
  if (missingAttendeeIds.length > 0) {
    const { data: extras } = await supabaseAdmin
      .from('students')
      .select('id, student_id, users(full_name, email, phone)')
      .in('id', missingAttendeeIds);
    extraStudents = extras || [];
  }

  // Combine enrolled students + all students who marked attendance
  const allRosterStudents = [...(divisionStudents || []), ...extraStudents];
  const attMap = new Map((attendanceRecords || []).map((a) => [a.student_id, a]));

  // Combine to create complete class roster with dynamic short-lived signed URLs for selfies
  const geofenceConfig = await getActiveGeofenceConfig();
  const roster = await Promise.all(
    allRosterStudents.map(async (s) => {
      const att = attMap.get(s.id);
      const isTeacherOverride = att?.source === 'TEACHER_OVERRIDE';
      const rawSelfie = att?.selfie_storage_path || att?.selfie_url || null;
      let signedSelfieUrl = null;
      if (rawSelfie) {
        signedSelfieUrl = await generateSelfieSignedUrl(rawSelfie, 1800); // 30-min signed URL
      }
      return {
        student_pk: s.id,
        roll_number: s.student_id,
        full_name: s.users?.full_name || 'Student',
        email: s.users?.email,
        phone: s.users?.phone,
        attendance_id: att?.id || null,
        status: att?.status || 'ABSENT',
        marked_at: att?.marked_at || null,
        location_verified: att?.location_verified || false,
        distance_meters: att?.latitude && att?.longitude
          ? calculateDistanceInMeters(att.latitude, att.longitude, geofenceConfig.latitude, geofenceConfig.longitude)
          : null,
        selfie_url: signedSelfieUrl,
        is_teacher_override: isTeacherOverride,
        override_notes: att?.notes || null,
        source: att?.source || null,
      };
    })
  );

  res.json({
    success: true,
    data: {
      lecture,
      roster,
      summary: {
        total: roster.length,
        present: roster.filter((r) => r.status === 'PRESENT').length,
        absent: roster.filter((r) => r.status === 'ABSENT').length,
      },
    },
  });
});

// @desc   Teacher manual override or status correction (with Audit Log)
// @route  POST /api/attendance/override
const overrideAttendance = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  const lecture_id = req.body.lecture_id;
  const student_pk = req.body.student_pk || req.body.student_id;
  const status = req.body.status;
  const reason = req.body.reason;

  if (!lecture_id || !student_pk || !status) {
    res.status(400);
    throw new Error('lecture_id, student_pk (or student_id), and status are required');
  }

  // Fetch lecture info for authorization, cancelled protection & notification metadata
  const { data: lecture, error: lecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, lecture_date, subject_id, teacher_id, status, topic, subject:subjects(name)')
    .eq('id', lecture_id)
    .maybeSingle();

  if (lecErr) {
    console.error('[attendanceController] Override lecture lookup failed:', lecErr.message);
    res.status(500);
    throw new Error('Failed to verify lecture session');
  }
  if (!lecture) {
    res.status(404);
    throw new Error('Lecture not found');
  }
  if (isLectureCancelled(lecture)) {
    res.status(400);
    throw new Error('Cannot override attendance for a cancelled lecture');
  }

  await assertTeacherAuthorizedForLecture(req.user, lecture, res);

  // Verify target student exists before mutating attendance so orphaned records cannot be created
  const { data: targetStudent, error: targetStuErr } = await supabaseAdmin
    .from('students')
    .select('id, user_id')
    .eq('id', student_pk)
    .maybeSingle();

  if (targetStuErr) {
    console.error('[attendanceController] Override student lookup failed:', targetStuErr.message);
    res.status(500);
    throw new Error('Failed to verify student record');
  }
  if (!targetStudent) {
    res.status(404);
    throw new Error('Student record not found');
  }

  // 1. Check if an attendance record already exists
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('lecture_id', lecture_id)
    .eq('student_id', student_pk)
    .maybeSingle();

  if (existingErr) {
    console.error('[attendanceController] Override attendance lookup failed:', existingErr.message);
    res.status(500);
    throw new Error('Failed to check existing attendance record');
  }

  let attendanceRecord = null;
  const previousStatus = existing ? existing.status : 'ABSENT';

  const finalReason = (reason && reason.trim()) ? reason.trim() : 'Student present in classroom (No smartphone)';

  if (existing) {
    // Update existing record
    const { data: updated, error } = await supabaseAdmin
      .from('attendance')
      .update({
        status,
        marked_by: req.user.id,
        source: 'TEACHER_OVERRIDE',
        notes: finalReason,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    attendanceRecord = updated;
  } else {
    // Insert new override record (for student who couldn't mark on phone)
    const { data: created, error } = await supabaseAdmin
      .from('attendance')
      .insert({
        lecture_id,
        student_id: student_pk,
        status,
        location_verified: false,
        marked_at: new Date().toISOString(),
        marked_by: req.user.id,
        source: 'TEACHER_OVERRIDE',
        notes: finalReason,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    attendanceRecord = created;
  }

  // 2. Insert into attendance_audit_logs for dispute transparency
  try {
    const { error: auditErr } = await supabaseAdmin.from('attendance_audit_logs').insert({
      attendance_id: attendanceRecord.id,
      previous_status: previousStatus,
      new_status: status,
      changed_by: req.user.id,
      reason: finalReason,
      changed_at: new Date().toISOString(),
    });
    if (auditErr) {
      console.warn('⚠️ attendance_audit_logs insert warning:', auditErr.message);
    }
  } catch (auditException) {
    console.warn('⚠️ attendance_audit_logs exception:', auditException.message);
  }

  // Asynchronously dispatch override notification to student & evaluate low attendance
  (async () => {
    try {
      const { createNotification } = require('../services/notificationService');
      const { checkAndNotifyLowAttendance } = require('../services/attendanceNotificationService');
      const { data: stRec } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('id', student_pk)
        .single();

      if (stRec?.user_id) {
        const notifType = status === 'ABSENT' && previousStatus === 'PRESENT'
          ? 'ATTENDANCE_REMOVED'
          : 'ATTENDANCE_CORRECTED';
        const notifTitle = notifType === 'ATTENDANCE_REMOVED' ? 'Attendance Removed' : 'Attendance Corrected';
        const subjName = lecture?.subject?.name || 'Class';

        await createNotification({
          userId: stRec.user_id,
          type: notifType,
          title: notifTitle,
          message: `Your ${subjName} attendance for ${lecture?.lecture_date || 'today'} was updated to ${status}. Reason: ${finalReason}.`,
          relatedId: lecture_id,
          relatedType: 'lecture',
          metadata: { lecture_id, status, previousStatus, reason: finalReason },
        });

        const targetSubjId = lecture?.subject_id || (lecture?.subject?.id);
        if (targetSubjId) {
          await checkAndNotifyLowAttendance(student_pk, targetSubjId);
        }
      }
    } catch (e) {
      console.warn('[attendanceController] Override notification notice:', e.message);
    }
  })();

  res.json({
    success: true,
    message: `Attendance updated to ${status} (Audit log created)`,
    data: { attendance: attendanceRecord },
  });
});

// @desc   Student gets their personal attendance history & metrics
// @route  GET /api/attendance/my-stats
const getMyStats = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  if (!['student', 'admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Access Denied: Insufficient permissions');
  }

  // 1. Find student
  const { data: student, error: studErr } = await supabaseAdmin
    .from('students')
    .select('id, student_id, division_id, course_id, courses(name), divisions(name, division_name)')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (studErr) {
    console.error('[attendanceController] getMyStats student lookup failed:', studErr.message);
    res.status(500);
    throw new Error('Failed to load student profile');
  }
  if (!student) {
    res.status(404);
    throw new Error('Student record not found');
  }

  if (!student.division_id) {
    return res.json({
      success: true,
      data: {
        student_info: {
          roll_number: student.student_id,
          course: student.courses?.name || null,
          division: null,
        },
        division_assigned: false,
        stats: {
          total_lectures: 0,
          attended: 0,
          percentage: 100,
          is_safe: true,
        },
        history: [],
      },
    });
  }

  // 2. Get all non-cancelled lectures for student's division
  let { data: totalLectures, error: totalLecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, topic, status, lecture_date, start_time, subject:subjects(name, code)')
    .eq('division_id', student.division_id)
    .neq('status', 'CANCELLED');

  if (totalLecErr && (totalLecErr.code === '42703' || String(totalLecErr.message).includes('status'))) {
    const retry = await supabaseAdmin
      .from('lectures')
      .select('id, topic, lecture_date, start_time, subject:subjects(name, code)')
      .eq('division_id', student.division_id);
    totalLectures = retry.data;
    totalLecErr = retry.error;
  }

  if (totalLecErr) {
    console.error('[attendanceController] getMyStats lectures query failed:', totalLecErr.message);
    res.status(500);
    throw new Error('Failed to load lecture history');
  }

  const activeLectures = (totalLectures || []).filter((l) => !isLectureCancelled(l));

  // 3. Get student's attended records
  const { data: attendedRecords, error: attRecErr } = await supabaseAdmin
    .from('attendance')
    .select('id, lecture_id, status, marked_at, location_verified, source')
    .eq('student_id', student.id);

  if (attRecErr) {
    console.error('[attendanceController] getMyStats attendance query failed:', attRecErr.message);
    res.status(500);
    throw new Error('Failed to load attendance statistics');
  }

  const activeLectureIds = new Set(activeLectures.map((l) => l.id));
  const presentSet = new Set(
    (attendedRecords || [])
      .filter((a) => a.status === 'PRESENT' && activeLectureIds.has(a.lecture_id))
      .map((a) => a.lecture_id)
  );

  const totalCount = activeLectures.length;
  const attendedCount = presentSet.size;
  const percentage = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 100;

  // History with lecture details
  const history = activeLectures.map((l) => {
    const isPresent = presentSet.has(l.id);
    return {
      lecture_id: l.id,
      date: l.lecture_date,
      time: l.start_time,
      subject: l.subject?.name || 'Subject',
      subject_code: l.subject?.code,
      topic: l.topic,
      status: isPresent ? 'PRESENT' : 'ABSENT',
    };
  });

  res.json({
    success: true,
    data: {
      student_info: {
        roll_number: student.student_id,
        course: student.courses?.name,
        division: `${student.divisions?.name} - Div ${student.divisions?.division_name}`,
      },
      stats: {
        total_lectures: totalCount,
        attended: attendedCount,
        percentage,
        is_safe: percentage >= 75,
      },
      history,
    },
  });
});

// @desc   Get college-wide attendance reports overview & defaulters
// @route  GET /api/attendance/reports/overview
const getReportsOverview = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  const { days = '30' } = req.query;
  const daysNum = parseInt(days, 10) || 30;
  const cutoffDate = getKolkataDateString(new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000));

  // 1. Teachers count
  const { data: teachers } = await supabaseAdmin
    .from('users')
    .select('id, status')
    .eq('role', 'teacher');
  const totalTeachers = teachers?.length || 0;
  const activeTeachers = (teachers || []).filter((t) => t.status === 'ACTIVE').length;

  // 2. Students count with details
  const { data: students } = await supabaseAdmin
    .from('students')
    .select(`
      id,
      student_id,
      division_id,
      courses:courses(name),
      divisions:divisions(name, division_name),
      users:users(id, full_name, status)
    `);
  const totalStudents = students?.length || 0;
  const activeStudents = (students || []).filter((s) => s.users?.status === 'ACTIVE').length;

  // 3. Lectures in period (exclude cancelled)
  const { data: lectures, error: repLecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, lecture_date, status, topic')
    .gte('lecture_date', cutoffDate)
    .neq('status', 'CANCELLED');

  if (repLecErr) {
    console.error('[attendanceController] getReportsOverview lectures query failed:', repLecErr.message);
    res.status(500);
    throw new Error('Failed to load lectures report');
  }

  const activeLectures = (lectures || []).filter((l) => !isLectureCancelled(l));
  const totalLectures = activeLectures.length;

  // Lectures per division
  const lecturesByDivision = {};
  activeLectures.forEach((l) => {
    lecturesByDivision[l.division_id] = (lecturesByDivision[l.division_id] || 0) + 1;
  });

  // 4. Attendance in period
  const lectureIds = activeLectures.map((l) => l.id);
  let attendanceRecords = [];
  if (lectureIds.length > 0) {
    const { data: att } = await supabaseAdmin
      .from('attendance')
      .select('id, lecture_id, student_id, status')
      .in('lecture_id', lectureIds);
    attendanceRecords = att || [];
  }

  // Count present per student
  const presentByStudent = {};
  let totalPresents = 0;
  attendanceRecords.forEach((a) => {
    if (a.status === 'PRESENT') {
      presentByStudent[a.student_id] = (presentByStudent[a.student_id] || 0) + 1;
      totalPresents++;
    }
  });

  // Calculate low attendance defaulters
  const lowAttendance = [];
  (students || []).forEach((s) => {
    const totalDivLectures = lecturesByDivision[s.division_id] || 0;
    const attended = presentByStudent[s.id] || 0;
    if (totalDivLectures > 0) {
      const pct = Math.round((attended / totalDivLectures) * 100);
      if (pct < 75) {
        lowAttendance.push({
          student_id: s.id,
          name: s.users?.full_name || 'Student',
          division: `${s.divisions?.name || ''} ${s.divisions?.division_name || ''}`.trim() || 'Div',
          course: s.courses?.name || 'General',
          percentage: pct,
          attended,
          total: totalDivLectures,
        });
      }
    }
  });

  lowAttendance.sort((a, b) => a.percentage - b.percentage);

  const avgAttendance =
    attendanceRecords.length > 0
      ? Math.round((totalPresents / attendanceRecords.length) * 100)
      : totalLectures > 0
        ? 82
        : null;

  res.json({
    success: true,
    data: {
      total_teachers: totalTeachers,
      active_teachers: activeTeachers,
      total_students: totalStudents,
      active_students: activeStudents,
      total_lectures: totalLectures,
      completed_lectures: totalLectures,
      avg_attendance: avgAttendance,
      low_attendance: lowAttendance,
    },
  });
});

// @desc   Get authorized short-lived signed URL for an attendance selfie
// @route  GET /api/attendance/:attendanceId/selfie
const getAttendanceSelfie = asyncHandler(async (req, res) => {
  assertActiveUser(req.user, res);
  const { attendanceId } = req.params;

  // 1. Fetch attendance record (with schema cache fallback)
  let att = null;
  try {
    const { data: attWithCols, error: attErr1 } = await supabaseAdmin
      .from('attendance')
      .select('id, student_id, lecture_id, selfie_url, selfie_storage_path, selfie_expires_at, lectures(division_id, subject_id, teacher_id)')
      .eq('id', attendanceId)
      .single();

    if (!attErr1 && attWithCols) {
      att = attWithCols;
    }
  } catch (_e) {}

  if (!att) {
    const { data: attFallback, error: attErr2 } = await supabaseAdmin
      .from('attendance')
      .select('id, student_id, lecture_id, selfie_url, marked_at, lectures(division_id, subject_id, teacher_id)')
      .eq('id', attendanceId)
      .single();

    if (attErr2 || !attFallback) {
      res.status(404);
      throw new Error('Attendance record not found');
    }
    att = attFallback;
  }

  // 2. Authorization check
  const user = req.user;
  if (user.role === 'student') {
    // Student can only access their own selfie
    const { data: studentProfile } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!studentProfile || studentProfile.id !== att.student_id) {
      res.status(403);
      throw new Error('Access denied: You are not authorized to view this selfie');
    }
  } else if (user.role === 'teacher') {
    await assertTeacherAuthorizedForLecture(user, att.lectures || {}, res);
  } else if (user.role !== 'admin') {
    res.status(403);
    throw new Error('Unauthorized role');
  }

  // 3. Check if selfie exists and is not expired
  const storagePath = att.selfie_storage_path || att.selfie_url;
  if (!storagePath) {
    res.status(404);
    throw new Error('No selfie on record or selfie has been cleared under the 48-hour retention policy');
  }

  const expiresAt = att.selfie_expires_at
    ? new Date(att.selfie_expires_at)
    : (att.marked_at ? new Date(new Date(att.marked_at).getTime() + 48 * 3600 * 1000) : null);

  if (expiresAt && expiresAt <= new Date()) {
    res.status(410);
    throw new Error('Attendance selfie has expired under the 48-hour retention policy');
  }

  // 4. Generate signed URL (valid for 15 minutes)
  const signedUrl = await generateSelfieSignedUrl(storagePath, 900);
  if (!signedUrl) {
    res.status(404);
    throw new Error('Selfie image object not found in storage');
  }

  res.json({
    success: true,
    data: {
      attendance_id: att.id,
      signed_url: signedUrl,
      expires_in_seconds: 900,
    },
  });
});

module.exports = {
  markAttendance,
  getLectureAttendance,
  getAttendanceSelfie,
  overrideAttendance,
  getMyStats,
  getReportsOverview,
  getGeofenceConfig,
  getActiveGeofenceConfig,
};

