const { supabaseAdmin } = require('../config/db');

async function setupLec() {
  const { data: subjs } = await supabaseAdmin.from('subjects').select('*');
  const { data: tchs } = await supabaseAdmin.from('teachers').select('*');
  const { data: divs } = await supabaseAdmin.from('divisions').select('*');

  const tch = tchs.find(t => t.teacher_id === 'TCH-1001') || tchs[0];
  const subj = subjs[0];
  const div = divs[0];

  // Assign all subjects to teacher
  for (const s of subjs) {
    await supabaseAdmin.from('teacher_subjects').upsert({
      teacher_id: tch.id,
      subject_id: s.id,
    }, { onConflict: 'teacher_id,subject_id' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const { data: lec, error } = await supabaseAdmin.from('lectures').insert({
    subject_id: subj.id,
    teacher_id: tch.id,
    division_id: div.id,
    lecture_date: todayStr,
    start_time: '08:00:00',
    end_time: '23:59:59',
    topic: 'Python Programming - Lab and Syntax Basics',
    created_by: tch.user_id,
  }).select().single();

  console.log('LECTURE CREATED:', lec?.id, error);
}

setupLec();
