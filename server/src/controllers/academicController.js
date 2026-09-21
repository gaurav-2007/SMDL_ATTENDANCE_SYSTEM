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

module.exports = {
  getCourses,
  getDivisions,
  getSubjects,
};
