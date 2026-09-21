const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// @desc   Get announcements (filtered for user or all for admin)
// @route  GET /api/announcements
const getAnnouncements = asyncHandler(async (req, res) => {
  const user = req.user;

  // Simple query approach to avoid foreign key alias mismatches
  const { data: announcements, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  // Load author names
  const authorIds = [...new Set((announcements || []).map((a) => a.sent_by).filter(Boolean))];
  const userMap = {};
  if (authorIds.length > 0) {
    const { data: authors } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role')
      .in('id', authorIds);
    (authors || []).forEach((u) => { userMap[u.id] = u; });
  }

  let filtered = announcements || [];

  // If student or teacher, filter appropriately
  if (user.role === 'student') {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('course_id, division_id')
      .eq('user_id', user.id)
      .maybeSingle();

    filtered = filtered.filter((a) => {
      if (a.target_type === 'ALL' || a.target_type === 'STUDENT') return true;
      if (a.target_type === 'COURSE' && a.target_id === student?.course_id) return true;
      if (a.target_type === 'DIVISION' && a.target_id === student?.division_id) return true;
      return false;
    });
  } else if (user.role === 'teacher') {
    filtered = filtered.filter((a) => a.target_type !== 'STUDENT');
  }

  const mapped = filtered.map((a) => ({
    ...a,
    sent_by_user: {
      name: userMap[a.sent_by]?.full_name || 'Administration',
      role: userMap[a.sent_by]?.role || 'admin',
    },
  }));

  res.json({
    success: true,
    count: mapped.length,
    data: { announcements: mapped },
  });
});

// @desc   Create a new announcement
// @route  POST /api/announcements
const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, target_type, target_id } = req.body;

  if (!title?.trim() || !content?.trim()) {
    res.status(400);
    throw new Error('Title and content are required');
  }

  const validTargetTypes = ['ALL', 'TEACHER', 'STUDENT', 'DIVISION', 'COURSE'];
  const target = target_type || 'ALL';

  if (!validTargetTypes.includes(target)) {
    res.status(400);
    throw new Error(`Invalid target type. Must be one of: ${validTargetTypes.join(', ')}`);
  }

  const { data: announcement, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      title: title.trim(),
      content: content.trim(),
      target_type: target,
      target_id: target_id || null,
      sent_by: req.user.id,
    })
    .select()
    .single();

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.status(201).json({
    success: true,
    message: 'Announcement published successfully',
    data: {
      announcement: {
        ...announcement,
        sent_by_user: {
          name: req.user.full_name,
          role: req.user.role,
        },
      },
    },
  });
});

// @desc   Delete announcement
// @route  DELETE /api/announcements/:id
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query = supabaseAdmin
    .from('announcements')
    .delete()
    .eq('id', id);

  if (req.user.role !== 'admin') {
    query = query.eq('sent_by', req.user.id);
  }

  const { error } = await query;
  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    message: 'Announcement deleted successfully',
  });
});

module.exports = {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
};
