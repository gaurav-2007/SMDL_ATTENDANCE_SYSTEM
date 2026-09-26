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

const buildUserResponse = async (u, token) => {
  const userObj = dbToUser(u);
  let profile = null;

  if (u.role === 'student') {
    const { data: s } = await supabaseAdmin
      .from('students')
      .select('student_id, course_id, division_id, courses(id, name, code), divisions(id, name, division_name)')
      .eq('user_id', u.id)
      .maybeSingle();

    if (s) {
      profile = {
        roll_number: s.student_id,
        course_id: s.course_id,
        division_id: s.division_id,
        course: s.courses?.name || '',
        course_code: s.courses?.code || '',
        division: s.divisions?.name || '',
      };
      userObj.roll_number = s.student_id;
      userObj.course = s.courses?.name || '';
      userObj.course_code = s.courses?.code || '';
      userObj.division = s.divisions?.name || '';
      userObj.class = s.divisions?.name || '';
    }
  } else if (u.role === 'teacher') {
    const { data: t } = await supabaseAdmin
      .from('teachers')
      .select('teacher_id, department, designation')
      .eq('user_id', u.id)
      .maybeSingle();

    if (t) {
      profile = {
        employee_id: t.teacher_id,
        department: t.department,
        designation: t.designation,
      };
      userObj.employee_id = t.teacher_id;
      userObj.department = t.department;
    }
  }

  userObj.profile = profile;

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

  let assignedCourseId = (parsed.course_id && parsed.course_id.trim()) ? parsed.course_id.trim() : null;
  let assignedDivisionId = (parsed.division_id && parsed.division_id.trim()) ? parsed.division_id.trim() : null;

  // If course_id is not set, resolve by branch/department name
  if (!assignedCourseId && (parsed.branch || parsed.department || req.body.branch || req.body.department)) {
    const rawBranch = (parsed.branch || parsed.department || req.body.branch || req.body.department).trim().toLowerCase();
    const { data: allCourses } = await supabaseAdmin.from('courses').select('id, name, code');
    if (allCourses && allCourses.length > 0) {
      const match = allCourses.find(c => 
        c.name.toLowerCase().includes(rawBranch) || 
        c.code.toLowerCase().includes(rawBranch) ||
        rawBranch.includes(c.code.toLowerCase())
      );
      if (match) assignedCourseId = match.id;
    }
  }

  // Resolve division_id if not explicitly provided
  if (!assignedDivisionId) {
    const className = (parsed.class || req.body.class || '').trim().toLowerCase();
    const divName = (parsed.division || req.body.division || '').trim().toLowerCase();
    const roll = (parsed.roll_number || '').trim().toLowerCase();

    let query = supabaseAdmin.from('divisions').select('id, course_id, name, division_name');
    if (assignedCourseId) {
      query = query.eq('course_id', assignedCourseId);
    }
    const { data: divs } = await query;

    if (divs && divs.length > 0) {
      const matched = divs.find(d => {
        const dName = d.name.toLowerCase();
        const dDiv = (d.division_name || '').toLowerCase();
        const matchYear = className ? (dName.includes(className) || (className.includes('fy') && dName.includes('fy')) || (className.includes('sy') && dName.includes('sy')) || (className.includes('ty') && dName.includes('ty'))) : true;
        const matchDiv = divName ? (dDiv === divName || dName.includes(divName)) : true;
        return matchYear && matchDiv;
      }) || divs[0];

      if (matched) {
        assignedDivisionId = matched.id;
        assignedCourseId = assignedCourseId || matched.course_id;
      }
    }
  }

  const { error: studErr } = await supabaseAdmin.from('students').insert({
    user_id: user.id,
    student_id: parsed.roll_number,
    course_id: assignedCourseId,
    division_id: assignedDivisionId,
  });

  if (studErr) {
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    res.status(500);
    throw new Error(studErr.message || 'Failed to create student profile');
  }

  const token = signToken({ id: user.id, role: user.role });
  const userData = await buildUserResponse(user, token);

  res.status(201).json({
    success: true,
    message: 'Student registered successfully',
    data: userData,
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
  const userData = await buildUserResponse(user, token);

  res.status(201).json({
    success: true,
    message:
      'Teacher registration submitted. Awaiting admin approval. You can login but access will be limited.',
    data: userData,
  });
});

const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  let target = (parsed.email || '').trim();
  if (target.toLowerCase() === 'admin') {
    target = 'admin@smdl.ac.in';
  }

  let user = null;

  // 1. If it contains @, lookup by email
  if (target.includes('@')) {
    const { data: userByEmail } = await supabaseAdmin
      .from('users')
      .select(USER_SELECT)
      .ilike('email', target.toLowerCase())
      .maybeSingle();
    user = userByEmail;
  } else {
    // 2. Lookup as Student Roll Number (student_id)
    const { data: studentMatch } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .ilike('student_id', target)
      .maybeSingle();

    if (studentMatch?.user_id) {
      const { data: userByRoll } = await supabaseAdmin
        .from('users')
        .select(USER_SELECT)
        .eq('id', studentMatch.user_id)
        .maybeSingle();
      user = userByRoll;
    }

    // 3. Lookup as Teacher Employee ID (teacher_id)
    if (!user) {
      const { data: teacherMatch } = await supabaseAdmin
        .from('teachers')
        .select('user_id')
        .ilike('teacher_id', target)
        .maybeSingle();

      if (teacherMatch?.user_id) {
        const { data: userByEmp } = await supabaseAdmin
          .from('users')
          .select(USER_SELECT)
          .eq('id', teacherMatch.user_id)
          .maybeSingle();
        user = userByEmp;
      }
    }

    // 4. Fallback search by email
    if (!user) {
      const { data: userFallback } = await supabaseAdmin
        .from('users')
        .select(USER_SELECT)
        .ilike('email', target.toLowerCase())
        .maybeSingle();
      user = userFallback;
    }
  }

  if (!user) {
    res.status(401);
    throw new Error('Invalid email, roll number, or password');
  }

  const isMatch = await comparePassword(parsed.password, user.password_hash);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid email, roll number, or password');
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
  const userData = await buildUserResponse(user, token);

  res.json({
    success: true,
    message:
      user.status === 'PENDING'
        ? `Welcome ${user.full_name}. Your account is pending approval.`
        : `Welcome ${user.full_name}!`,
    data: userData,
  });
});

const getMe = asyncHandler(async (req, res) => {
  let extraProfile = null;

  if (req.user.role === 'student') {
    const { data } = await supabaseAdmin
      .from('students')
      .select('student_id, course_id, division_id, courses(id, name, code), divisions(id, name, division_name)')
      .eq('user_id', req.user.id)
      .maybeSingle();
    extraProfile = data
      ? {
          roll_number: data.student_id,
          course_id: data.course_id,
          division_id: data.division_id,
          course: data.courses?.name || '',
          course_code: data.courses?.code || '',
          division: data.divisions?.name || '',
          class: data.divisions?.name || '',
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
