const { supabaseAdmin } = require('../src/config/db');

async function checkPoojaTeacher() {
  const poojaUserId = '6ce48acb-b1ef-4eb2-a0bf-5447f88baa41';
  const { data: t, error } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, department')
    .eq('user_id', poojaUserId)
    .maybeSingle();
  console.log('Teacher record for Pooja:', t, 'error:', error);

  if (t) {
    const { data: ts, error: tsErr } = await supabaseAdmin
      .from('teacher_subjects')
      .select('subject_id')
      .eq('teacher_id', t.id);
    console.log('teacher_subjects for Pooja:', ts, 'tsErr:', tsErr);
  }
}

checkPoojaTeacher().catch(console.error);
