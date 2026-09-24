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

module.exports = {
  listPendingTeachers,
  approveTeacher,
  rejectTeacher,
  listStudents,
  updateStudentStatus,
};
