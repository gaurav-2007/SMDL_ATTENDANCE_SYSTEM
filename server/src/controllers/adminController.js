const { z } = require('zod');
const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { getKolkataDateString } = require('../utils/dateUtils');
const {
  sendTeacherApprovalEmail,
  sendTeacherRejectionEmail,
} = require('../services/emailService');

const approveSchema = z.object({
  reason: z.string().max(500).optional(),
  subject_ids: z.array(z.string().uuid()).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required').max(500),
});

const userSelect =
  'id, email, full_name, role, status, phone, created_at, updated_at';

const mapRow = (user, profile, subjects = []) => ({
  // User fields
  id: user.id,
  user_id: user.id,
  name: user.full_name,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  status: user.status,
  account_status: user.status,
  phone: user.phone,
  created_at: user.created_at,
  // Flattened profile fields (for convenient frontend access)
  teacher_profile_id: profile?.id || null,
  employee_id: profile?.teacher_id || null,
  department: profile?.department || null,
  designation: profile?.designation || null,
  registered_at: profile?.registration_submitted_at || user.created_at,
  approved_at: profile?.approved_at || null,
  rejection_reason: profile?.rejection_reason || null,
  assigned_subjects: subjects,
  assigned_subject_ids: subjects.map((s) => s.id),
  // Nested profile (for backward compatibility)
  profile: profile
    ? {
        id: profile.id,
        employee_id: profile.teacher_id,
        department: profile.department,
        designation: profile.designation,
        registration_submitted_at: profile.registration_submitted_at,
        approved_at: profile.approved_at,
        approved_by: profile.approved_by,
        rejection_reason: profile.rejection_reason,
        assigned_subjects: subjects,
        assigned_subject_ids: subjects.map((s) => s.id),
      }
    : null,
});

const listPendingTeachers = asyncHandler(async (req, res) => {
  const { data: users, error: uErr } = await supabaseAdmin
    .from('users')
    .select(userSelect)
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });

  if (uErr) {
    res.status(500);
    throw new Error(uErr.message);
  }

  const ids = (users || []).map((u) => u.id);
  const profiles = {};
  if (ids.length > 0) {
    const { data: tp, error: tpErr } = await supabaseAdmin
      .from('teachers')
      .select('id, user_id, teacher_id, department, designation, registration_submitted_at, approved_at, approved_by, rejection_reason')
      .in('user_id', ids);
    if (tpErr) {
      res.status(500);
      throw new Error(tpErr.message);
    }
    (tp || []).forEach((p) => { profiles[p.user_id] = p; });
  }

  // Fetch assigned subjects for all teachers
  const teacherPkIds = Object.values(profiles).map((p) => p.id).filter(Boolean);
  const teacherSubjectsMap = {};
  if (teacherPkIds.length > 0) {
    const { data: tsData } = await supabaseAdmin
      .from('teacher_subjects')
      .select('teacher_id, subject:subjects(id, name, code, division:divisions(id, name, division_name, course:courses(name, code)))')
      .in('teacher_id', teacherPkIds);

    (tsData || []).forEach((ts) => {
      if (!teacherSubjectsMap[ts.teacher_id]) teacherSubjectsMap[ts.teacher_id] = [];
      if (ts.subject) teacherSubjectsMap[ts.teacher_id].push(ts.subject);
    });
  }

  const teachers = (users || []).map((u) => {
    const prof = profiles[u.id];
    const subjs = prof?.id ? (teacherSubjectsMap[prof.id] || []) : [];
    return mapRow(u, prof, subjs);
  });
  const pending = teachers.filter((t) => t.account_status === 'PENDING');

  res.json({
    success: true,
    count: teachers.length,
    pending_count: pending.length,
    // 'teachers' is an alias for 'all' so both AdminHome and TeachersPanel work seamlessly
    data: { pending, all: teachers, teachers },
  });
});

const approveTeacher = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params;
  const parsed = approveSchema.parse(req.body || {});

  const { data: t, error: tErr } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, status')
    .eq('id', teacher_id)
    .maybeSingle();

  if (tErr || !t) {
    res.status(404);
    throw new Error('Teacher not found');
  }
  if (t.role !== 'teacher') {
    res.status(400);
    throw new Error(`User is ${t.role}, not a teacher`);
  }
  // Allow approving PENDING or REJECTED teachers (re-approval)
  if (t.status !== 'PENDING' && t.status !== 'REJECTED') {
    res.status(400);
    throw new Error(`Cannot approve: account status is ${t.status}`);
  }

  const now = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ status: 'ACTIVE', updated_at: now })
    .eq('id', teacher_id);

  if (updErr) {
    res.status(500);
    throw new Error(updErr.message || 'Failed to update user status');
  }

  const { data: updatedTeacher, error: tchErr } = await supabaseAdmin
    .from('teachers')
    .update({
      approved_at: now,
      approved_by: req.user.id,
      rejection_reason: parsed.reason || null,
      updated_at: now,
    })
    .eq('user_id', teacher_id)
    .select('id')
    .maybeSingle();

  if (tchErr) {
    res.status(500);
    throw new Error(tchErr.message || 'Failed to update teacher profile');
  }

  // Assign subjects if selected during approval
  if (Array.isArray(parsed.subject_ids) && updatedTeacher?.id) {
    await supabaseAdmin
      .from('teacher_subjects')
      .delete()
      .eq('teacher_id', updatedTeacher.id);

    if (parsed.subject_ids.length > 0) {
      const rows = parsed.subject_ids.map((subId) => ({
        teacher_id: updatedTeacher.id,
        subject_id: subId,
      }));
      await supabaseAdmin.from('teacher_subjects').insert(rows);
    }
  }

  // Notify teacher of approval
  (async () => {
    try {
      const { createNotification } = require('../services/notificationService');
      await createNotification({
        userId: teacher_id,
        type: 'TEACHER_APPROVED',
        title: 'Teacher Account Approved',
        message: 'Your teacher account has been approved. You can now access the faculty dashboard and manage your assigned classes.',
        relatedId: teacher_id,
        relatedType: 'teacher',
        metadata: { approved_by: req.user.id },
      });
    } catch (_e) {}

    try {
      await sendTeacherApprovalEmail(t.email, t.full_name);
    } catch (e) {
      console.error('Failed to send teacher approval email:', e.message);
    }
  })();

  res.json({
    success: true,
    message: `Teacher ${t.full_name} (${t.email}) approved successfully. They now have full dashboard access.`,
    data: {
      id: teacher_id,
      account_status: 'ACTIVE',
      approved_at: now,
      approved_by: req.user.id,
    },
  });
});

const rejectTeacher = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params;
  const parsed = rejectSchema.parse(req.body || {});

  const { data: t, error: tErr } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, status')
    .eq('id', teacher_id)
    .maybeSingle();

  if (tErr || !t) {
    res.status(404);
    throw new Error('Teacher not found');
  }
  if (t.role !== 'teacher') {
    res.status(400);
    throw new Error(`User is ${t.role}, not a teacher`);
  }
  if (
    t.status !== 'PENDING' &&
    t.status !== 'ACTIVE' &&
    t.status !== 'SUSPENDED'
  ) {
    res.status(400);
    throw new Error(`Cannot reject: account status is ${t.status}`);
  }

  const now = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ status: 'REJECTED', updated_at: now })
    .eq('id', teacher_id);

  if (updErr) {
    res.status(500);
    throw new Error(updErr.message || 'Failed to update user status');
  }

  const { error: tchErr } = await supabaseAdmin
    .from('teachers')
    .update({ rejection_reason: parsed.reason, updated_at: now })
    .eq('user_id', teacher_id);

  if (tchErr) {
    res.status(500);
    throw new Error(tchErr.message || 'Failed to store rejection reason');
  }

  // Notify teacher of rejection
  (async () => {
    try {
      const { createNotification } = require('../services/notificationService');
      await createNotification({
        userId: teacher_id,
        type: 'TEACHER_REJECTED',
        title: 'Teacher Registration Update',
        message: `Your teacher registration request was rejected. Reason: ${parsed.reason}. Please contact the college administrator for assistance.`,
        relatedId: teacher_id,
        relatedType: 'teacher',
        metadata: { rejected_by: req.user.id, reason: parsed.reason },
      });
    } catch (_e) {}

    try {
      await sendTeacherRejectionEmail(t.email, t.full_name, parsed.reason);
    } catch (e) {
      console.error('Failed to send teacher rejection email:', e.message);
    }
  })();

  res.json({
    success: true,
    message: `Teacher ${t.full_name} rejected. Reason saved. They will NOT receive dashboard access.`,
    data: {
      id: teacher_id,
      account_status: 'REJECTED',
      rejected_at: now,
      rejected_by: req.user.id,
      reason: parsed.reason,
    },
  });
});

const listStudents = asyncHandler(async (req, res) => {
  const { data: students, error } = await supabaseAdmin
    .from('students')
    .select(`
      id,
      student_id,
      user_id,
      courses:courses(id, name, code),
      divisions:divisions(id, name, division_name),
      users:users(id, full_name, email, phone, status, created_at)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  const mapped = (students || []).map((s) => ({
    id: s.id,
    user_id: s.user_id,
    roll_number: s.student_id,
    full_name: s.users?.full_name || 'Student',
    phone: s.users?.phone,
    courses: s.courses,
    divisions: s.divisions,
    users: s.users || {
      status: 'PENDING',
      email: '',
    },
  }));

  res.json({
    success: true,
    count: mapped.length,
    data: { students: mapped },
  });
});

const updateStudentStatus = asyncHandler(async (req, res) => {
  const { student_id } = req.params;
  const { status } = req.body;

  const validStatuses = ['ACTIVE', 'PENDING', 'REJECTED', 'INACTIVE'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Find student to get user_id
  let userId = student_id;
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('user_id')
    .eq('id', student_id)
    .maybeSingle();

  if (student?.user_id) {
    userId = student.user_id;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('users')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, status')
    .maybeSingle();

  if (error || !updated) {
    res.status(500);
    throw new Error(error?.message || 'Failed to update student status');
  }

  res.json({
    success: true,
    message: `Student status updated to ${status}`,
    data: { student: updated },
  });
});

const { hashPassword } = require('../utils/password');

// @desc   Admin suspends teacher and globally terminates active sessions (Fix #3)
// @route  POST /api/admin/teachers/:teacher_id/suspend
const suspendTeacher = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params;
  const { reason } = req.body || {};

  const { data: user, error: uErr } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role, status')
    .eq('id', teacher_id)
    .maybeSingle();

  if (uErr || !user) {
    res.status(404);
    throw new Error('Teacher account not found');
  }

  const now = new Date().toISOString();

  // 1. Update status in database
  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ status: 'SUSPENDED', updated_at: now })
    .eq('id', teacher_id);

  if (updErr) {
    res.status(500);
    throw new Error(updErr.message || 'Failed to update user status');
  }

  await supabaseAdmin
    .from('teachers')
    .update({
      rejection_reason: reason ? `[SUSPENDED]: ${reason}` : '[SUSPENDED by Admin]',
      updated_at: now,
    })
    .eq('user_id', teacher_id);

  // 2. Fix #3: Invalidate active login session globally in Supabase Auth
  try {
    if (supabaseAdmin.auth?.admin?.signOut) {
      await supabaseAdmin.auth.admin.signOut(teacher_id, 'global');
    }
  } catch (authErr) {
    console.warn('Notice: global auth sign-out call:', authErr.message);
  }

  // Security alert notification
  try {
    const { createNotification } = require('../services/notificationService');
    await createNotification({
      userId: teacher_id,
      type: 'SECURITY_ALERT',
      title: 'Account Suspended',
      message: `Your teacher account has been suspended by the administration.${reason ? ` Reason: ${reason}` : ''}`,
      relatedId: teacher_id,
      relatedType: 'teacher',
      metadata: { reason },
    });
  } catch (_e) {}

  res.json({
    success: true,
    message: `Teacher ${user.full_name} has been suspended and their active sessions were terminated.`,
    data: {
      id: teacher_id,
      account_status: 'SUSPENDED',
      reason,
    },
  });
});

// @desc   Admin disables teacher permanently (Fix #3)
// @route  POST /api/admin/teachers/:teacher_id/disable
const disableTeacher = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params;
  const { reason } = req.body || {};

  const { data: user, error: uErr } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role, status')
    .eq('id', teacher_id)
    .maybeSingle();

  if (uErr || !user) {
    res.status(404);
    throw new Error('Teacher account not found');
  }

  const now = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ status: 'DISABLED', updated_at: now })
    .eq('id', teacher_id);

  if (updErr) {
    res.status(500);
    throw new Error(updErr.message || 'Failed to disable user');
  }

  await supabaseAdmin
    .from('teachers')
    .update({
      rejection_reason: reason ? `[DISABLED]: ${reason}` : '[DISABLED by Admin]',
      updated_at: now,
    })
    .eq('user_id', teacher_id);

  try {
    if (supabaseAdmin.auth?.admin?.signOut) {
      await supabaseAdmin.auth.admin.signOut(teacher_id, 'global');
    }
  } catch (authErr) {
    console.warn('Notice: global auth sign-out call:', authErr.message);
  }

  // Security alert notification
  try {
    const { createNotification } = require('../services/notificationService');
    await createNotification({
      userId: teacher_id,
      type: 'SECURITY_ALERT',
      title: 'Account Disabled',
      message: `Your account has been permanently disabled by the administration.${reason ? ` Reason: ${reason}` : ''}`,
      relatedId: teacher_id,
      relatedType: 'teacher',
      metadata: { reason },
    });
  } catch (_e) {}

  res.json({
    success: true,
    message: `Teacher ${user.full_name} has been disabled and immediately logged out.`,
    data: {
      id: teacher_id,
      account_status: 'DISABLED',
      reason,
    },
  });
});

const normalizeOptionalId = (val) => {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed ? trimmed : null;
};

const fetchTrustedDivisionById = async (divisionId, cache = null) => {
  if (!divisionId) return null;
  if (cache && cache.has(divisionId)) {
    return cache.get(divisionId);
  }
  const { data: division, error } = await supabaseAdmin
    .from('divisions')
    .select('id, course_id, name, division_name')
    .eq('id', divisionId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message || 'Failed to verify target division');
    err.statusCode = 500;
    throw err;
  }
  if (cache && division) {
    cache.set(divisionId, division);
  }
  return division || null;
};

const fetchTrustedCourseById = async (courseId, cache = null) => {
  if (!courseId) return null;
  if (cache && cache.has(courseId)) {
    return cache.get(courseId);
  }
  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select('id, name, code')
    .eq('id', courseId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message || 'Failed to verify target course');
    err.statusCode = 500;
    throw err;
  }
  if (cache && course) {
    cache.set(courseId, course);
  }
  return course || null;
};

// @desc   Bulk Import Students via CSV data
// @route  POST /api/admin/students/bulk-import
const bulkImportStudents = asyncHandler(async (req, res) => {
  const { students, division_id, course_id, default_password } = req.body;
  if (!students || !Array.isArray(students) || students.length === 0) {
    res.status(400);
    throw new Error('Students array is required');
  }

  const pwd = default_password || 'Student@123';
  const hashedPassword = await hashPassword(pwd);

  const imported = [];
  const errors = [];
  const divisionCache = new Map();
  const courseCache = new Map();

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const roll = s.roll_number || s.roll || s.student_id;
    const name = s.full_name || s.name;
    const email = s.email || `${String(roll).toLowerCase()}@student.smdl.ac.in`;
    const phone = s.phone ? String(s.phone) : null;
    const targetDiv = normalizeOptionalId(s.division_id) || normalizeOptionalId(division_id);
    const targetCourse = normalizeOptionalId(s.course_id) || normalizeOptionalId(course_id);

    if (!roll || !name) {
      errors.push({ row: i + 1, error: 'Missing roll number or full name' });
      continue;
    }

    const normalizedRoll = String(roll).trim().toUpperCase();

    try {
      // Validate division & derive authoritative course_id BEFORE creating user/student rows
      let resolvedDivisionId = null;
      let resolvedCourseId = null;

      if (targetDiv) {
        const divRec = await fetchTrustedDivisionById(targetDiv, divisionCache);
        if (!divRec) {
          errors.push({ row: i + 1, roll, error: 'Target division not found' });
          continue;
        }
        if (targetCourse && divRec.course_id !== targetCourse) {
          errors.push({ row: i + 1, roll, error: 'Course does not match the target division' });
          continue;
        }
        resolvedDivisionId = divRec.id;
        resolvedCourseId = divRec.course_id ?? null;
      } else if (targetCourse) {
        const courseRec = await fetchTrustedCourseById(targetCourse, courseCache);
        if (!courseRec) {
          errors.push({ row: i + 1, roll, error: 'Target course not found' });
          continue;
        }
        resolvedCourseId = courseRec.id;
      }

      // Check if user already exists
      const { data: existingUser, error: exUserErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (exUserErr) {
        errors.push({ row: i + 1, roll, error: exUserErr.message });
        continue;
      }

      let userId;
      let createdNewUser = false;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: uErr } = await supabaseAdmin
          .from('users')
          .insert({
            email,
            password: hashedPassword,
            full_name: name.trim(),
            role: 'student',
            status: 'ACTIVE',
            phone,
          })
          .select('id')
          .single();

        if (uErr) {
          errors.push({ row: i + 1, roll, error: uErr.message });
          continue;
        }
        userId = newUser.id;
        createdNewUser = true;
      }

      // Check if student profile exists
      const { data: existingProfile, error: exProfErr } = await supabaseAdmin
        .from('students')
        .select('id, user_id, student_id')
        .or(`student_id.eq.${normalizedRoll},user_id.eq.${userId}`)
        .maybeSingle();

      if (exProfErr) {
        if (createdNewUser) {
          await supabaseAdmin.from('users').delete().eq('id', userId);
        }
        errors.push({ row: i + 1, roll, error: exProfErr.message });
        continue;
      }

      if (!existingProfile) {
        const { error: sErr } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: userId,
            student_id: normalizedRoll,
            division_id: resolvedDivisionId,
            course_id: resolvedCourseId,
          });

        if (sErr) {
          if (createdNewUser) {
            await supabaseAdmin.from('users').delete().eq('id', userId);
          }
          errors.push({ row: i + 1, roll, error: sErr.message });
          continue;
        }
      } else {
        if (createdNewUser || (existingProfile.user_id && existingProfile.user_id !== userId)) {
          if (createdNewUser) {
            await supabaseAdmin.from('users').delete().eq('id', userId);
          }
          errors.push({ row: i + 1, roll, error: 'Roll number already assigned to another student' });
          continue;
        }
        if (resolvedDivisionId) {
          const { error: updErr } = await supabaseAdmin
            .from('students')
            .update({
              division_id: resolvedDivisionId,
              course_id: resolvedCourseId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProfile.id);

          if (updErr) {
            errors.push({ row: i + 1, roll, error: updErr.message });
            continue;
          }
        }
      }

      imported.push({ roll_number: roll, full_name: name, email });
    } catch (err) {
      errors.push({ row: i + 1, roll, error: err.message });
    }
  }

  res.status(201).json({
    success: true,
    message: `Processed ${students.length} students: ${imported.length} imported/updated, ${errors.length} skipped or failed.`,
    data: {
      total: students.length,
      imported_count: imported.length,
      error_count: errors.length,
      imported,
      errors,
    },
  });
});

// @desc   Transfer student to another division / batch
// @route  POST /api/admin/students/:student_id/transfer
const transferStudentDivision = asyncHandler(async (req, res) => {
  const { student_id } = req.params;
  const new_division_id = normalizeOptionalId(req.body.new_division_id || req.body.division_id);
  const reason = req.body.reason;

  if (!new_division_id) {
    res.status(400);
    throw new Error('New division is required');
  }

  // 1. Validate target division and derive authoritative course_id from DB (never trust client course_id)
  const targetDivision = await fetchTrustedDivisionById(new_division_id);
  if (!targetDivision) {
    res.status(404);
    throw new Error('Target division not found');
  }

  // 2. Look up student record by internal id, user_id, or roll number (student_id)
  const { data: stRec, error: stErr } = await supabaseAdmin
    .from('students')
    .select('id, user_id, student_id')
    .or(`id.eq.${student_id},user_id.eq.${student_id},student_id.eq.${student_id}`)
    .maybeSingle();

  if (stErr) {
    res.status(500);
    throw new Error(stErr.message || 'Failed to verify student record');
  }
  if (!stRec) {
    res.status(404);
    throw new Error('Student record not found');
  }

  // 3. Update division_id and derived course_id together in a single DB update
  const updateData = {
    division_id: targetDivision.id,
    course_id: targetDivision.course_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabaseAdmin
    .from('students')
    .update(updateData)
    .eq('id', stRec.id)
    .select('*, divisions(name, division_name), users(full_name, email)')
    .single();

  if (error || !updated) {
    res.status(500);
    throw new Error(error?.message || 'Failed to transfer student');
  }

  res.json({
    success: true,
    message: `Student transferred to ${updated.divisions?.name || 'new division'} successfully.`,
    data: { student: updated, reason },
  });
});

// @desc   Today's live attendance summary
// @route  GET /api/admin/attendance/live-summary
const getLiveAttendanceSummary = asyncHandler(async (_req, res) => {
  const todayStr = getKolkataDateString();

  const { count: studentCount } = await supabaseAdmin
    .from('students')
    .select('*', { count: 'exact', head: true });

  const { data: todayLectures, error: todayLecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, start_time, end_time, status, topic, subject:subjects(name, code), division:divisions(name)')
    .eq('lecture_date', todayStr).neq('status', 'CANCELLED');

  if (todayLecErr) { res.status(500); throw new Error(todayLecErr.message); } const activeTodayLectures = (todayLectures || []).filter((l) => l.status !== 'CANCELLED' && !l.topic?.includes('[CANCELLED]')); const lectureIds = activeTodayLectures.map((l) => l.id);

  let presentCount = 0;
  let absentCount = 0;

  if (lectureIds.length > 0) {
    const { count: pCount } = await supabaseAdmin
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .in('lecture_id', lectureIds)
      .eq('status', 'PRESENT');

    const { count: aCount } = await supabaseAdmin
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .in('lecture_id', lectureIds)
      .eq('status', 'ABSENT');

    presentCount = pCount || 0;
    absentCount = aCount || 0;
  }

  const totalMarked = presentCount + absentCount;
  const attendanceRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

  res.json({
    success: true,
    data: {
      date: todayStr,
      total_students: studentCount || 0,
      today_lectures_count: activeTodayLectures.length,
      present_count: presentCount,
      absent_count: absentCount,
      total_marked: totalMarked,
      attendance_percentage: attendanceRate,
      active_lectures: activeTodayLectures,
    },
  });
});

// @desc   Get Attendance Override Audit Logs (Fix #1 viewable by Admin only)
// @route  GET /api/admin/attendance/audit-logs
const getAttendanceAuditLogs = asyncHandler(async (_req, res) => {
  let logs = [];
  const { data: richLogs, error: rErr } = await supabaseAdmin
    .from('attendance_audit_logs')
    .select(`
      *,
      user:users!attendance_audit_logs_changed_by_fkey(id, full_name, role, email)
    `)
    .order('changed_at', { ascending: false })
    .limit(100);

  if (!rErr && richLogs) {
    logs = richLogs;
  } else {
    const { data: rawLogs } = await supabaseAdmin
      .from('attendance_audit_logs')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);
    logs = rawLogs || [];
  }

  const mappedLogs = (logs || []).map((l) => ({
    ...l,
    old_status: l.previous_status || l.old_status_enum || l.old_status,
    created_at: l.changed_at || l.created_at,
  }));

  res.json({
    success: true,
    count: mappedLogs.length,
    data: { logs: mappedLogs },
  });
});

// @desc   Get system configuration
// @route  GET /api/admin/config
const getSystemConfig = asyncHandler(async (_req, res) => {
  const { data: configs, error } = await supabaseAdmin
    .from('system_config')
    .select('*')
    .order('config_key', { ascending: true });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  const settings = {};
  (configs || []).forEach((c) => {
    settings[c.config_key] = c.config_value;
  });

  res.json({
    success: true,
    data: {
      configs: configs || [],
      settings,
    },
  });
});

function validateGeofenceConfigValue(key, value) {
  if (key === 'college_latitude') {
    const lat = parseFloat(value);
    if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) {
      const err = new Error('Invalid latitude: must be a number between -90 and 90');
      err.statusCode = 400;
      throw err;
    }
    return lat.toString();
  }
  if (key === 'college_longitude') {
    const lon = parseFloat(value);
    if (isNaN(lon) || !isFinite(lon) || lon < -180 || lon > 180) {
      const err = new Error('Invalid longitude: must be a number between -180 and 180');
      err.statusCode = 400;
      throw err;
    }
    return lon.toString();
  }
  if (key === 'geofence_radius_meters') {
    const rad = parseInt(value, 10);
    if (isNaN(rad) || !isFinite(rad) || rad <= 0 || !/^\d+$/.test(String(value).trim())) {
      const err = new Error('Invalid geofence radius: must be a positive integer greater than 0');
      err.statusCode = 400;
      throw err;
    }
    if (rad > 50000) {
      const err = new Error('Invalid geofence radius: cannot exceed 50,000 meters');
      err.statusCode = 400;
      throw err;
    }
    return rad.toString();
  }
  return String(value);
}

// @desc   Update system configuration
// @route  PUT /api/admin/config
const updateSystemConfig = asyncHandler(async (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    res.status(400);
    throw new Error('Configuration payload is required');
  }

  if (updates.key && updates.value !== undefined) {
    try {
      const sanitizedVal = validateGeofenceConfigValue(updates.key, updates.value);
      const { data, error } = await supabaseAdmin
        .from('system_config')
        .upsert(
          {
            config_key: updates.key,
            config_value: sanitizedVal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'config_key' }
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return res.json({
        success: true,
        message: `Configuration ${updates.key} updated`,
        data: { config: data },
      });
    } catch (valErr) {
      res.status(valErr.statusCode || 400);
      throw valErr;
    }
  }

  // Pre-validate all entries before writing to prevent partial corrupt state
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined && val !== null) {
      try {
        validateGeofenceConfigValue(key, val);
      } catch (valErr) {
        res.status(valErr.statusCode || 400);
        throw valErr;
      }
    }
  }

  const results = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined && val !== null) {
      const sanitizedVal = validateGeofenceConfigValue(key, val);
      const { data, error } = await supabaseAdmin
        .from('system_config')
        .upsert(
          {
            config_key: key,
            config_value: sanitizedVal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'config_key' }
        )
        .select()
        .maybeSingle();

      if (!error && data) results.push(data);
    }
  }

  res.json({
    success: true,
    message: 'System configurations updated successfully',
    data: { updated: results },
  });
});

const assignTeacherSubjects = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params;
  const { subject_ids } = req.body;

  if (!Array.isArray(subject_ids)) {
    res.status(400);
    throw new Error('subject_ids must be an array of subject IDs');
  }

  // Find teacher record by user_id or primary key id
  let { data: teacherRec } = await supabaseAdmin
    .from('teachers')
    .select('id, user_id, department')
    .or(`id.eq.${teacher_id},user_id.eq.${teacher_id}`)
    .maybeSingle();

  if (!teacherRec) {
    res.status(404);
    throw new Error('Teacher record not found');
  }

  // Delete previous subject assignments
  const { error: delErr } = await supabaseAdmin
    .from('teacher_subjects')
    .delete()
    .eq('teacher_id', teacherRec.id);

  if (delErr) {
    res.status(500);
    throw new Error(delErr.message);
  }

  // Insert new subject assignments
  if (subject_ids.length > 0) {
    const rows = subject_ids.map((subId) => ({
      teacher_id: teacherRec.id,
      subject_id: subId,
    }));
    const { error: insErr } = await supabaseAdmin
      .from('teacher_subjects')
      .insert(rows);

    if (insErr) {
      res.status(500);
      throw new Error(insErr.message);
    }
  }

  // Fetch updated subjects with division & course
  const { data: updatedSubjs } = await supabaseAdmin
    .from('teacher_subjects')
    .select('subject:subjects(id, name, code, division:divisions(id, name, division_name, course:courses(name, code)))')
    .eq('teacher_id', teacherRec.id);

  const subjectsList = (updatedSubjs || []).map((x) => x.subject).filter(Boolean);

  res.json({
    success: true,
    message: `Updated subject assignments (${subjectsList.length} subjects assigned).`,
    data: {
      teacher_id: teacherRec.id,
      assigned_subjects: subjectsList,
      assigned_subject_ids: subjectsList.map((s) => s.id),
    },
  });
});

module.exports = {
  listPendingTeachers,
  approveTeacher,
  rejectTeacher,
  suspendTeacher,
  disableTeacher,
  assignTeacherSubjects,
  listStudents,
  updateStudentStatus,
  bulkImportStudents,
  transferStudentDivision,
  getLiveAttendanceSummary,
  getAttendanceAuditLogs,
  getSystemConfig,
  updateSystemConfig,
};

