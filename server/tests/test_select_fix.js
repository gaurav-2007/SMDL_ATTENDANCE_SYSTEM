const { supabaseAdmin } = require('../src/config/db');

async function testSelect() {
  const { data, error } = await supabaseAdmin
    .from('lectures')
    .select('id, subject_id, teacher_id, division_id, semester, academic_year, start_time, end_time, topic, lecture_date')
    .eq('lecture_date', '2026-11-26')
    .limit(5);

  console.log('Query without status - Error:', error);
  console.log('Query without status - First row:', data ? data[0] : null);
}

testSelect();
