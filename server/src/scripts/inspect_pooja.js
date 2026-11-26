const { supabaseAdmin } = require('../config/db');

async function checkPoojaSubjects() {
  const teacherId = 'c716f397-da15-47aa-8ec6-f70a694974f2';
  const { data: ts } = await supabaseAdmin
    .from('teacher_subjects')
    .select('id, subject_id, subjects(id, name, code, semester, division_id)')
    .eq('teacher_id', teacherId);
  console.log('Pooja Chande assigned subjects:', JSON.stringify(ts, null, 2));

  const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', '6ce48acb-b1ef-4eb2-a0bf-5447f88baa41').single();
  console.log('User details for Pooja:', user);
}

checkPoojaSubjects();
