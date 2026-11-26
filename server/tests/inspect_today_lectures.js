const { supabaseAdmin } = require('../src/config/db');

async function inspectLecturesToday() {
  const today = '2026-11-26';
  const { data: lecs, error } = await supabaseAdmin
    .from('lectures')
    .select('id, subject_id, teacher_id, division_id, lecture_date, start_time, end_time, topic, semester, academic_year, created_at, created_by, subject:subjects(name, code), division:divisions(name)')
    .eq('lecture_date', today)
    .order('created_at', { ascending: true });

  console.log(`Total lectures for today (${today}):`, lecs ? lecs.length : 0);
  if (lecs) {
    lecs.forEach((l, idx) => {
      console.log(`[${idx + 1}] ID: ${l.id} | Subj: ${l.subject?.name} (${l.subject?.code}) | Div: ${l.division?.name} | Time: ${l.start_time}-${l.end_time} | Sem: ${l.semester} | CreatedAt: ${l.created_at} | CreatedBy: ${l.created_by} | Topic: ${l.topic}`);
    });
  }
}

inspectLecturesToday();
