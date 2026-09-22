// Diagnostic: Why teacher doesn't see student's marked attendance
const { supabaseAdmin } = require('../config/db');

async function main() {
  if (!supabaseAdmin) { console.log('NO SUPABASE CLIENT'); return; }
  const today = new Date().toISOString().split('T')[0];
  console.log('TODAY:', today, '\n');

  // 1. Today's lectures
  const { data: lecs } = await supabaseAdmin
    .from('lectures')
    .select('id, subject_id, teacher_id, division_id, lecture_date, start_time, end_time, topic, created_by')
    .eq('lecture_date', today)
    .order('created_at', { ascending: true });

  console.log('=== LECTURES TODAY ===');
  (lecs || []).forEach((l, i) => {
    console.log(`[${i}] id=${l.id}\n    div=${l.division_id} teacher=${l.teacher_id} subj=${l.subject_id} time=${l.start_time}-${l.end_time} topic=${l.topic}`);
  });

  // 2. Teachers
  const { data: teachers } = await supabaseAdmin
    .from('teachers').select('id, teacher_id, user_id');
  console.log('\n=== TEACHERS ===');
  (teachers || []).forEach(t => console.log(` id=${t.id} code=${t.teacher_id} user=${t.user_id}`));

  // 3. Students
  const { data: students } = await supabaseAdmin
    .from('students').select('id, student_id, user_id, division_id, course_id');
  console.log('\n=== STUDENTS ===');
  (students || []).forEach(s => console.log(` id=${s.id} roll=${s.student_id} div=${s.division_id} course=${s.course_id}`));

  // 4. Attendance records (all, recent)
  const { data: atts } = await supabaseAdmin
    .from('attendance')
    .select('id, lecture_id, student_id, status, marked_at, source, selfie_url')
    .order('marked_at', { ascending: false })
    .limit(20);
  console.log('\n=== ATTENDANCE RECORDS (latest 20) ===');
  if (!atts || atts.length === 0) console.log(' (none)');
  (atts || []).forEach(a => console.log(` id=${a.id}\n    lec=${a.lecture_id} student=${a.student_id} status=${a.status} src=${a.source} at=${a.marked_at} selfie=${a.selfie_url ? 'YES(' + a.selfie_url.length + ' chars)' : 'NO'}`));

  // 5. CROSS-CHECK: for each lecture, does roster logic find the student?
  console.log('\n=== CROSS-CHECK (roster logic per lecture) ===');
  for (const l of (lecs || [])) {
    const { data: divStudents } = await supabaseAdmin
      .from('students').select('id, student_id, division_id, users(full_name)')
      .eq('division_id', l.division_id);
    const { data: attRec } = await supabaseAdmin
      .from('attendance').select('id, student_id, status, source').eq('lecture_id', l.id);
    const rosterIds = new Set((divStudents || []).map(s => s.id));
    const orphan = (attRec || []).filter(a => !rosterIds.has(a.student_id));
    console.log(` Lecture ${l.id}`);
    console.log(`   div=${l.division_id} -> roster size=${(divStudents || []).length}, attendance rows=${(attRec || []).length}`);
    if (orphan.length) console.log(`   ⚠️ ORPHAN ATTENDANCE (student NOT in lecture's division): ${orphan.map(o => o.student_id).join(', ')}`);
    if ((attRec || []).length === 0) console.log(`   ⚠️ NO attendance rows for this lecture`);
  }

  // 6. Check for lectures missing division (would break roster)
  const badLecs = (lecs || []).filter(l => !l.division_id);
  if (badLecs.length) console.log('\n⚠️ LECTURES WITHOUT division_id:', badLecs.map(l => l.id).join(', '));

  // 7. Students without division
  const noDiv = (students || []).filter(s => !s.division_id);
  if (noDiv.length) console.log('\n⚠️ STUDENTS WITHOUT division_id:', noDiv.map(s => s.student_id).join(', '));

  console.log('\nDONE');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
