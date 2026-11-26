const { supabaseAdmin } = require('../src/config/db');

async function findAttendedLectures() {
  const { data: att } = await supabaseAdmin.from('attendance').select('id, lecture_id, student_id, status');
  console.log('Total attendance records in DB:', att ? att.length : 0);
  const attendedLecIds = [...new Set((att || []).map(a => a.lecture_id))];
  console.log('Attended lecture IDs:', attendedLecIds);
}

findAttendedLectures();
