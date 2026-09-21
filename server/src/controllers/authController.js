const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const {
  registerStudentSchema,
  registerTeacherSchema,
  loginSchema,
} = require('../utils/validators');

const dbToUser = (u) => ({
  id: u.id,
  name: u.full_name,
  email: u.email,
  role: u.role,
  account_status: u.status,
  phone: u.phone,
  created_at: u.created_at,
  updated_at: u.updated_at,
});

const buildUserResponse = (u, token) => {
  const userObj = dbToUser(u);
  return {
    ...userObj,
    user: userObj,
    token,
  };
};

const USER_SELECT =
  'id, email, full_name, role, status, phone, password_hash, last_login_at, created_at, updated_at';

const registerStudent = asyncHandler(async (req, res) => {
  const parsed = registerStudentSchema.parse(req.body);
  const studentFullName = (parsed.name || parsed.full_name || req.body.name || req.body.full_name || '').trim();

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', parsed.email)
    .maybeSingle();

  if (existing) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const { data: rollCheck } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('student_id', parsed.roll_number)
    .maybeSingle();

  if (rollCheck) {
    res.status(400);
    throw new Error('Roll number already in use');
  }

  const passwordHash = await hashPassword(parsed.password);

  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .insert({
      email: parsed.email,
      full_name: studentFullName,
      password_hash: passwordHash,
      role: 'student',
      status: 'ACTIVE',
      phone: parsed.phone || null,
    })
    .select(USER_SELECT)
    .single();

  if (userErr || !user) {
    res.status(500);
    throw new Error(userErr?.message || 'Failed to create user');
  }

  const { error: studErr } = await supabaseAdmin.from('students').insert({
    user_id: user.id,
    student_id: parsed.roll_number,
    course_id: parsed.course_id || null,
    division_id: parsed.division_id || null,
  });

  if (studErr) {
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    res.status(500);
    throw new Error(studErr.message || 'Failed to create student profile');
  }

  const token = signToken({ id: user.id, role: user.role });

  res.status(201).json({
    success: true,
    message: 'Student registered successfully',
    data: buildUserResponse(user, token),
  });
});

const registerTeacher = asyncHandler(async (req, res) => {
  const parsed = registerTeacherSchema.parse(req.body);
  const teacherFullName = (parsed.name || parsed.full_name || req.body.name || req.body.full_name || '').trim();

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', parsed.email)
    .maybeSingle();

  if (existing) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const { data: empCheck } = await supabaseAdmin
    .from('teachers')
    .select('id')
    .eq('teacher_id', parsed.employee_id)
    .maybeSingle();

  if (empCheck) {
    res.status(400);
    throw new Error('Employee ID already in use');
  }

  const passwordHash = await hashPassword(parsed.password);

  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .insert({
      email: parsed.email,
      full_name: teacherFullName,
      password_hash: passwordHash,
      role: 'teacher',
      status: 'PENDING',
      phone: parsed.phone || null,
    })
    .select(USER_SELECT)
    .single();

  if (userErr || !user) {
    res.status(500);
    throw new Error(userErr?.message || 'Failed to create user');
  }

  const { error: tchErr } = await supabaseAdmin.from('teachers').insert({
    user_id: user.id,
    teacher_id: parsed.employee_id,
    department: parsed.department,
    registration_submitted_at: new Date().toISOString(),
  });

  if (tchErr) {
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    res.status(500);
    throw new Error(tchErr.message || 'Failed to create teacher profile');
  }

  const token = signToken({ id: user.id, role: user.role });

  res.status(201).json({
    success: true,
    message:
      'Teacher registration submitted. Awaiting admin approval. You can login but access will be limited.',
    data: buildUserResponse(user, token),
  });
});

const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  let targetEmail = (parsed.email || '').trim().toLowerCase();
  if (targetEmail === 'admin') {
    targetEmail = 'admin@smdl.ac.in';
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(USER_SELECT)
    .ilike('email', targetEmail)
    .maybeSingle();


  if (error || !user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const isMatch = await comparePassword(parsed.password, user.password_hash);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (
    user.status === 'REJECTED' ||
    user.status === 'SUSPENDED' ||
    user.status === 'DISABLED'
  ) {
    res.status(401);
    throw new Error(
      `Account is ${user.status.toLowerCase()}. Contact admin for support.`
    );
  }

  await supabaseAdmin
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const token = signToken({ id: user.id, role: user.role });

  res.json({
    success: true,
    message:
      user.status === 'PENDING'
        ? `Welcome ${user.full_name}. Your account is pending approval.`
        : `Welcome ${user.full_name}!`,
    data: buildUserResponse(user, token),
  });
});

const getMe = asyncHandler(async (req, res) => {
  let extraProfile = null;

  if (req.user.role === 'student') {
    const { data } = await supabaseAdmin
      .from('students')
      .select('student_id, course_id, division_id')
      .eq('user_id', req.user.id)
      .maybeSingle();
    extraProfile = data
      ? {
          roll_number: data.student_id,
          course_id: data.course_id,
          division_id: data.division_id,
        }
      : null;
  } else if (req.user.role === 'teacher') {
    const { data } = await supabaseAdmin
      .from('teachers')
      .select(
        'teacher_id, department, designation, registration_submitted_at, approved_at, approved_by, rejection_reason'
      )
      .eq('user_id', req.user.id)
      .maybeSingle();
    extraProfile = data
      ? {
          employee_id: data.teacher_id,
          department: data.department,
          designation: data.designation,
          registration_submitted_at: data.registration_submitted_at,
          approved_at: data.approved_at,
          approved_by: data.approved_by,
          rejection_reason: data.rejection_reason,
        }
      : null;
  }

  res.json({
    success: true,
    data: {
      ...req.user,
      profile: extraProfile,
    },
  });
});

module.exports = {
  registerStudent,
  registerTeacher,
  login,
  getMe,
};
