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
};
