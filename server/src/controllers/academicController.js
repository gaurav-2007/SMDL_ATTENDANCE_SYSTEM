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

// @desc   Get subjects (optionally by division or teacher)
// @route  GET /api/academic/subjects
const getSubjects = asyncHandler(async (req, res) => {
  const { division_id, teacher_id } = req.query;
  let query = supabaseAdmin.from('subjects').select('*, divisions(name, division_name, course_id)');

  if (division_id) {
    query = query.eq('division_id', division_id);
  }

  const { data: subjects, error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    data: { subjects },
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
    .select()
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }
  res.status(201).json({ success: true, message: 'Subject created successfully', data: { subject: data } });
});

module.exports = {
  getCourses,
  getDivisions,
  getSubjects,
  createCourse,
  createDivision,
  createSubject,
};
