const { supabaseAdmin } = require('../config/db');

async function checkSubjectsAndDivisions() {
  try {
    const { data: subs } = await supabaseAdmin.from('subjects').select('id, name, code, semester, division_id');
    const { data: divs } = await supabaseAdmin.from('divisions').select('id, name, division_name, current_semester');
    console.log('--- DIVISIONS ---');
    console.log(divs);
    console.log('--- SUBJECTS ---');
    console.log(subs);

    // Also check teacher_subjects for Pooja Chande
    const { data: teacher } = await supabaseAdmin.from('teachers').select('id, teacher_id, user_id, users(full_name, email)').eq('teacher_id', 'TCH-1002').single();
    console.log('--- TEACHER POOJA CHANDE ---');
    console.log(teacher);
    if (teacher) {
      const { data: ts } = await supabaseAdmin.from('teacher_subjects').select('id, subject_id, subjects(id, name, code, semester, division_id)').eq('teacher_id', teacher.id);
      console.log('Pooja Chande assigned subjects:', JSON.stringify(ts, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSubjectsAndDivisions();
