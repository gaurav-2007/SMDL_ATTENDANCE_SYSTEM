const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// @desc   Get all courses with divisions
// @route  GET /api/academic/courses
const getCourses = asyncHandler(async (req, res) => {
  const { data: courses, error } = await supabaseAdmin
    .from('courses')
    .select('*, divisions(*)');

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    data: { courses },
  });
});

// @desc   Get divisions
// @route  GET /api/academic/divisions
const getDivisions = asyncHandler(async (req, res) => {
  const { course_id } = req.query;
  let query = supabaseAdmin.from('divisions').select('*, courses(name, code)');
  if (course_id) {
    query = query.eq('course_id', course_id);
  }

  const { data: divisions, error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    data: { divisions },
  });
});

// @desc   Get subjects (optionally by division, course, or teacher)
// @route  GET /api/academic/subjects
const getSubjects = asyncHandler(async (req, res) => {
  const { division_id, teacher_id, course_id } = req.query;
  let query = supabaseAdmin
    .from('subjects')
    .select('*, divisions(id, name, division_name, course_id, courses(id, name, code))')
    .order('name', { ascending: true });

  if (division_id) {
    query = query.eq('division_id', division_id);
  }

  const { data: subjects, error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  let filtered = subjects || [];
  if (course_id) {
    filtered = filtered.filter(s => s.divisions?.course_id === course_id);
  }

  res.json({
    success: true,
    data: { subjects: filtered },
  });
});

// @desc   Admin creates new Course
// @route  POST /api/academic/courses
const createCourse = asyncHandler(async (req, res) => {
  const { name, code, duration_years } = req.body;
  if (!name || !code) {
    res.status(400);
    throw new Error('Course name and code are required');
  }
  const { data, error } = await supabaseAdmin
    .from('courses')
    .insert({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      duration_years: duration_years ? Number(duration_years) : 3,
    })
    .select()
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.status(201).json({ success: true, message: 'Course created successfully', data: { course: data } });
});

// @desc   Admin creates new Division
// @route  POST /api/academic/divisions
const createDivision = asyncHandler(async (req, res) => {
  const { course_id, name, division_name } = req.body;
  if (!course_id || !name || !division_name) {
    res.status(400);
    throw new Error('Course, Year/Name (e.g. FY), and Division Name (e.g. A) are required');
  }
  const { data, error } = await supabaseAdmin
    .from('divisions')
    .insert({
      course_id,
      name: name.trim(),
      division_name: division_name.trim().toUpperCase(),
    })
    .select()
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.status(201).json({ success: true, message: 'Division created successfully', data: { division: data } });
});

// @desc   Admin creates new Subject
// @route  POST /api/academic/subjects
const createSubject = asyncHandler(async (req, res) => {
  const { name, code, division_id } = req.body;
  if (!name || !code || !division_id) {
    res.status(400);
    throw new Error('Subject name, code, and division are required');
  }
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      division_id,
    })
    .select('*, divisions(id, name, division_name, course_id, courses(id, name, code))')
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.status(201).json({ success: true, message: 'Subject created successfully', data: { subject: data } });
});

// @desc   Admin batch adds subjects to a course / divisions
// @route  POST /api/academic/subjects/batch
const batchCreateSubjects = asyncHandler(async (req, res) => {
  const { division_ids, subjects } = req.body;
  if (!division_ids || !Array.isArray(division_ids) || division_ids.length === 0) {
    res.status(400);
    throw new Error('At least one division must be selected');
  }
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    res.status(400);
    throw new Error('At least one subject is required');
  }

  const rowsToInsert = [];
  for (const divId of division_ids) {
    for (const sub of subjects) {
      if (sub.name?.trim() && sub.code?.trim()) {
        rowsToInsert.push({
          division_id: divId,
          name: sub.name.trim(),
          code: sub.code.trim().toUpperCase(),
        });
      }
    }
  }

  if (rowsToInsert.length === 0) {
    res.status(400);
    throw new Error('Please provide valid subjects with name and code');
  }

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert(rowsToInsert)
    .select('*, divisions(id, name, division_name, course_id, courses(id, name, code))');

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.status(201).json({
    success: true,
    message: `${data.length} subject(s) added successfully`,
    data: { subjects: data },
  });
});

// @desc   Admin deletes Subject
// @route  DELETE /api/academic/subjects/:id
const deleteSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from('subjects').delete().eq('id', id);
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.json({ success: true, message: 'Subject deleted successfully' });
});

// @desc   Admin deletes Division
// @route  DELETE /api/academic/divisions/:id
const deleteDivision = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from('divisions').delete().eq('id', id);
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.json({ success: true, message: 'Division deleted successfully' });
});

// @desc   Admin deletes Course
// @route  DELETE /api/academic/courses/:id
const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from('courses').delete().eq('id', id);
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.json({ success: true, message: 'Course deleted successfully' });
});

// @desc   Get weekly timetable for a division
// @route  GET /api/academic/timetable/:division_id
const getDivisionTimetable = asyncHandler(async (req, res) => {
  const { division_id } = req.params;
  const { day_of_week } = req.query;

  let query = supabaseAdmin
    .from('division_timetables')
    .select(`
      id,
      division_id,
      day_of_week,
      start_time,
      end_time,
      room_number,
      is_lab,
      created_at,
      subject:subjects(id, name, code),
      teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name, email))
    `)
    .eq('division_id', division_id)
    .order('start_time', { ascending: true });

  if (day_of_week) {
    query = query.eq('day_of_week', day_of_week);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === 'PGRST205') {
      return res.json({
        success: true,
        data: { slots: [], table_missing: true },
        message: 'Table division_timetables not yet created. Run migration 20260925_simplified_admin_schema.sql in Supabase SQL editor.',
      });
    }
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    data: { slots: data || [] },
  });
});

// @desc   Admin saves a Timetable Slot (with Fix #2 Double-Booking Check)
// @route  POST /api/academic/timetable
const saveTimetableSlot = asyncHandler(async (req, res) => {
  const { id, division_id, day_of_week, start_time, end_time, subject_id, teacher_id, room_number, is_lab } = req.body;

  if (!division_id || !day_of_week || !start_time || !end_time || !subject_id) {
    res.status(400);
    throw new Error('Division, Day of Week, Start Time, End Time, and Subject are required');
  }

  // Fix #2: Double-booking check: Ensure teacher or room is not booked in another division at the same day & time
  let conflictQuery = supabaseAdmin
    .from('division_timetables')
    .select(`
      id,
      division_id,
      day_of_week,
      start_time,
      end_time,
      room_number,
      teacher_id,
      division:divisions(name, division_name),
      teacher:teachers(teacher_id, user:users!teachers_user_id_fkey(full_name))
    `)
    .eq('day_of_week', day_of_week)
    .eq('start_time', start_time)
    .neq('division_id', division_id);

  if (id) {
    conflictQuery = conflictQuery.neq('id', id);
  }

  const { data: conflicts, error: confErr } = await conflictQuery;
  if (!confErr && conflicts && conflicts.length > 0) {
    for (const c of conflicts) {
      if (teacher_id && c.teacher_id === teacher_id) {
        const teacherName = c.teacher?.user?.full_name || 'Selected Faculty';
        const otherDiv = c.division?.name || 'another division';
        res.status(409);
        throw new Error(`Double-booking conflict: ${teacherName} is already scheduled in ${otherDiv} on ${day_of_week} at ${start_time}.`);
      }
      if (room_number && c.room_number && c.room_number.trim().toLowerCase() === room_number.trim().toLowerCase()) {
        const otherDiv = c.division?.name || 'another division';
        res.status(409);
        throw new Error(`Double-booking conflict: Room ${room_number} is already reserved for ${otherDiv} on ${day_of_week} at ${start_time}.`);
      }
    }
  }

  const payload = {
    division_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    teacher_id: teacher_id || null,
    room_number: room_number ? room_number.trim() : 'Room 101',
    is_lab: !!is_lab,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (id) {
    result = await supabaseAdmin
      .from('division_timetables')
      .update(payload)
      .eq('id', id)
      .select('*, subject:subjects(id, name, code), teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name))')
      .single();
  } else {
    result = await supabaseAdmin
      .from('division_timetables')
      .insert(payload)
      .select('*, subject:subjects(id, name, code), teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(id, full_name))')
      .single();
  }

  if (result.error) {
    res.status(500);
    throw new Error(result.error.message);
  }

  res.status(id ? 200 : 201).json({
    success: true,
    message: id ? 'Timetable slot updated successfully' : 'Timetable slot added successfully',
    data: { slot: result.data },
  });
});

// @desc   Admin deletes a Timetable Slot
// @route  DELETE /api/academic/timetable/:id
const deleteTimetableSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from('division_timetables')
    .delete()
    .eq('id', id);

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({ success: true, message: 'Timetable slot deleted successfully' });
});

// @desc   1-Click populate official SMDL timetable for FYBSc CS
// @route  POST /api/academic/timetable/load-smdl-matrix
const loadSmdlTimetableMatrix = asyncHandler(async (req, res) => {
  const { division_id } = req.body;
  if (!division_id) {
    res.status(400);
    throw new Error('division_id is required');
  }

  const { SMDL_TIMETABLE_MATRIX } = require('../services/timetableService');

  // Get subjects for this division
  const { data: subjects } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code')
    .eq('division_id', division_id);

  const subjectMap = {};
  (subjects || []).forEach((s) => {
    subjectMap[s.code] = s;
    const match = s.name.match(/\(([^)]+)\)/);
    if (match) {
      subjectMap[match[1]] = s;
      subjectMap[match[1].toUpperCase()] = s;
    }
  });

  // Get teachers
  const { data: teachers } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, user:users!teachers_user_id_fkey(full_name)');

  const teacherMap = {};
  (teachers || []).forEach((t) => {
    if (t.user?.full_name) {
      teacherMap[t.user.full_name] = t;
    }
  });

  const slotsToInsert = [];
  const weekly = SMDL_TIMETABLE_MATRIX.weekly_schedule;
  const timeSlots = SMDL_TIMETABLE_MATRIX.time_slots;

  for (const day of Object.keys(weekly)) {
    const daySlots = weekly[day] || [];
    for (const item of daySlots) {
      const slotDef = timeSlots.find((s) => s.slot_id === item.slot_id);
      if (!slotDef) continue;
      const subj = subjectMap[item.code];
      const teacher = teacherMap[item.teacher];
      if (!subj) continue;

      slotsToInsert.push({
        division_id,
        day_of_week: day,
        start_time: slotDef.start_time,
        end_time: slotDef.end_time,
        subject_id: subj.id,
        teacher_id: teacher?.id || null,
        room_number: item.type === 'Practical' ? 'Lab 101' : 'Room 101',
        is_lab: item.type === 'Practical',
      });
    }
  }

  if (slotsToInsert.length === 0) {
    res.status(400);
    throw new Error('No matching subjects found to generate timetable slots. Ensure CS-01 to CS-14 subjects are added.');
  }

  // Clear existing slots for this division and insert fresh
  await supabaseAdmin.from('division_timetables').delete().eq('division_id', division_id);
  const { data, error } = await supabaseAdmin
    .from('division_timetables')
    .insert(slotsToInsert)
    .select();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.status(201).json({
    success: true,
    message: `Loaded ${data.length} official SMDL timetable slots for this division!`,
    data: { count: data.length },
  });
});

// @desc   Get list of active teachers for timetable assignment
// @route  GET /api/academic/teachers-list
const getTeachersList = asyncHandler(async (_req, res) => {
  const { data: teachers, error } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, department, designation, user:users!teachers_user_id_fkey(id, full_name, email, status)')
    .order('teacher_id', { ascending: true });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  const active = (teachers || []).filter(t => t.user?.status === 'ACTIVE');
  res.json({
    success: true,
    data: { teachers: active },
  });
});

module.exports = {
  getCourses,
  getDivisions,
  getSubjects,
  createCourse,
  createDivision,
  createSubject,
  batchCreateSubjects,
  deleteSubject,
  deleteDivision,
  deleteCourse,
  getDivisionTimetable,
  saveTimetableSlot,
  deleteTimetableSlot,
  loadSmdlTimetableMatrix,
  getTeachersList,
};
