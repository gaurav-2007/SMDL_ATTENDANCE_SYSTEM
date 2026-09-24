const { z } = require('zod');
const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const approveSchema = z.object({
  reason: z.string().max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required').max(500),
});

const userSelect =
  'id, email, full_name, role, status, phone, created_at, updated_at';

const mapRow = (user, profile) => ({
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
  employee_id: profile?.teacher_id || null,
  department: profile?.department || null,
  designation: profile?.designation || null,
  registered_at: profile?.registration_submitted_at || user.created_at,
  approved_at: profile?.approved_at || null,
  rejection_reason: profile?.rejection_reason || null,
  // Nested profile (for backward compatibility)
  profile: profile
    ? {
        employee_id: profile.teacher_id,
        department: profile.department,
        designation: profile.designation,
        registration_submitted_at: profile.registration_submitted_at,
        approved_at: profile.approved_at,
        approved_by: profile.approved_by,
        rejection_reason: profile.rejection_reason,
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
      .select('user_id, teacher_id, department, designation, registration_submitted_at, approved_at, approved_by, rejection_reason')
      .in('user_id', ids);
    if (tpErr) {
      res.status(500);
      throw new Error(tpErr.message);
    }
    (tp || []).forEach((p) => { profiles[p.user_id] = p; });
  }

  const teachers = (users || []).map((u) => mapRow(u, profiles[u.id]));
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

  const { error: tchErr } = await supabaseAdmin
    .from('teachers')
    .update({
      approved_at: now,
      approved_by: req.user.id,
      rejection_reason: parsed.reason || null,
      updated_at: now,
    })
    .eq('user_id', teacher_id);

  if (tchErr) {
    res.status(500);
    throw new Error(tchErr.message || 'Failed to update teacher profile');
  }

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

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const roll = s.roll_number || s.roll || s.student_id;
    const name = s.full_name || s.name;
    const email = s.email || `${String(roll).toLowerCase()}@student.smdl.ac.in`;
    const phone = s.phone ? String(s.phone) : null;
    const targetDiv = s.division_id || division_id;
    const targetCourse = s.course_id || course_id;

    if (!roll || !name) {
      errors.push({ row: i + 1, error: 'Missing roll number or full name' });
      continue;
    }

    try {
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let userId;
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
      }

      // Check if student profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from('students')
        .select('id')
        .or(`student_id.eq.${roll},user_id.eq.${userId}`)
        .maybeSingle();

      if (!existingProfile) {
        const { error: sErr } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: userId,
            student_id: String(roll).trim().toUpperCase(),
            division_id: targetDiv || null,
            course_id: targetCourse || null,
          });

        if (sErr) {
          errors.push({ row: i + 1, roll, error: sErr.message });
          continue;
        }
      } else {
        if (targetDiv) {
          await supabaseAdmin
            .from('students')
            .update({ division_id: targetDiv, course_id: targetCourse || undefined })
            .eq('id', existingProfile.id);
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
  const { new_division_id, new_course_id, reason } = req.body;

  if (!new_division_id) {
    res.status(400);
    throw new Error('New division is required');
  }

  const updateData = {
    division_id: new_division_id,
    updated_at: new Date().toISOString(),
  };
  if (new_course_id) {
    updateData.course_id = new_course_id;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('students')
    .update(updateData)
    .or(`id.eq.${student_id},student_id.eq.${student_id}`)
    .select('*, divisions(name, division_name), users(full_name, email)')
    .maybeSingle();

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
  const todayStr = new Date().toISOString().split('T')[0];

  const { count: studentCount } = await supabaseAdmin
    .from('students')
    .select('*', { count: 'exact', head: true });

  const { data: todayLectures } = await supabaseAdmin
    .from('lectures')
    .select('id, start_time, end_time, subject:subjects(name, code), division:divisions(name)')
    .eq('lecture_date', todayStr);

  const lectureIds = (todayLectures || []).map((l) => l.id);

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
      today_lectures_count: todayLectures?.length || 0,
      present_count: presentCount,
      absent_count: absentCount,
      total_marked: totalMarked,
      attendance_percentage: attendanceRate,
      active_lectures: todayLectures || [],
    },
  });
});

// @desc   Get Attendance Override Audit Logs (Fix #1 viewable by Admin only)
// @route  GET /api/admin/attendance/audit-logs
const getAttendanceAuditLogs = asyncHandler(async (_req, res) => {
  const { data: logs, error } = await supabaseAdmin
    .from('attendance_audit_logs')
    .select(`
      *,
      user:users!attendance_audit_logs_changed_by_fkey(id, full_name, role, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    const { data: fallbackLogs, error: fErr } = await supabaseAdmin
      .from('attendance_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (fErr) {
      return res.json({ success: true, data: { logs: [] } });
    }
    return res.json({ success: true, data: { logs: fallbackLogs || [] } });
  }

  res.json({
    success: true,
    count: logs?.length || 0,
    data: { logs: logs || [] },
  });
});

module.exports = {
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
};

