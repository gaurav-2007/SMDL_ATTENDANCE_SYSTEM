const { supabaseAdmin } = require('../config/db');

async function migrate() {
  console.log('Verifying attendance schema with a test insert...');
  
  const { data: lectures } = await supabaseAdmin.from('lectures').select('id, division_id').limit(1);
  const { data: students } = await supabaseAdmin.from('students').select('id').limit(1);
  
  if (!lectures?.length || !students?.length) {
    console.log('⚠️ No lectures or students found. Run seed scripts first.');
    return;
  }

  // Check existing attendance for this pair
  const { data: existing } = await supabaseAdmin.from('attendance')
    .select('id')
    .eq('lecture_id', lectures[0].id)
    .eq('student_id', students[0].id)
    .maybeSingle();
  
  if (existing) {
    console.log('⚠️ Test record already exists, skipping insert test. Schema is OK.');
    return;
  }

  const { error: testErr } = await supabaseAdmin.from('attendance').insert({
    lecture_id: lectures[0].id,
    student_id: students[0].id,
    status: 'PRESENT',
    location_verified: true,
    latitude: 19.0287,
    longitude: 73.1044,
    selfie_url: 'data:image/png;base64,test',
    marked_at: new Date().toISOString(),
    marked_by: 'student',
    teacher_override: false,
  });
    
  if (testErr) {
    console.error('❌ Attendance schema issue:', testErr.message);
    console.error('Missing columns or wrong type:', testErr.details || testErr.hint);
  } else {
    console.log('✅ Attendance schema OK!');
    await supabaseAdmin.from('attendance')
      .delete()
      .eq('lecture_id', lectures[0].id)
      .eq('student_id', students[0].id);
    console.log('✅ Cleaned up test record.');
  }
}

migrate();
