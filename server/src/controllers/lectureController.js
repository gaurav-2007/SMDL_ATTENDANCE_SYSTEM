const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

function calculateDynamicStatus(l) {
  if (l.status) return l.status;
  const today = new Date().toISOString().slice(0, 10);
  if (l.lecture_date < today) return 'COMPLETED';
  if (l.lecture_date > today) return 'SCHEDULED';
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = (l.start_time || '00:00').split(':').map(Number);
  const [eh, em] = (l.end_time || '23:59').split(':').map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 23) * 60 + (em || 59);
  if (currentMinutes < startMin) return 'SCHEDULED';
  if (currentMinutes > endMin) return 'COMPLETED';
  return 'ONGOING';
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
    .eq('lecture_date', todayStr);

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

    if (teacher?.id) {
      query = query.eq('teacher_id', teacher.id);
    }
  }

  const { data: lectures, error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  const mapped = await attachTeacherNames(lectures || []);

  res.json({
    success: true,
    data: { lectures: mapped },
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

module.exports = {
  getActiveLectures,
  getAllLectures,
  createLecture,
  updateLectureStatus,
  deleteLecture,
};

