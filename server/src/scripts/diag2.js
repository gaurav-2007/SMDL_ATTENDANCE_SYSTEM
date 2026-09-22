// Diagnostic 2: details of lectures that have attendance + roster dry-run
const { supabaseAdmin } = require('../config/db');

async function main() {
  const lecIds = ['a25911a3-684c-422a-b0a2-4a426de0485e', 'e7ef453f-1a63-418c-975f-c3945bae8f35'];

  for (const id of lecIds) {
    const { data: l } = await supabaseAdmin
      .from('lectures')
      .select('id, subject_id, teacher_id, division_id, lecture_date, start_time, end_time, topic, created_by, subjects(name, code), divisions(name, division_name)')
      .eq('id', id).single();
    console.log('=== LECTURE', id, '===');
    if (!l) { console.log(' NOT FOUND'); continue; }
    console.log(JSON.stringify(l, null, 2));

    // roster dry-run (same logic as backend)
    const { data: divStudents } = await supabaseAdmin
      .from('students').select('id, student_id, division_id, users(full_name)')
      .eq('division_id', l.division_id);
    const { data: attRec } = await supabaseAdmin
      .from('attendance').select('id, student_id, status, source').eq('lecture_id', id);
    console.log(` roster (students in div ${l.division_id}):`, (divStudents || []).map(s => `${s.student_id}(${s.users?.full_name})`));
    console.log(' attendance rows:', JSON.stringify(attRec));
    const rosterIds = new Set((divStudents || []).map(s => s.id));
    (attRec || []).forEach(a => {
      console.log(` student ${a.student_id} in roster? ${rosterIds.has(a.student_id)}`);
    });
    console.log('');
  }

  // Who is CS-2026-002?
  const { data: st } = await supabaseAdmin
    .from('students').select('*, users(full_name, email, status, role)').eq('student_id', 'CS-2026-002').single();
  console.log('=== STUDENT CS-2026-002 ===');
  console.log(JSON.stringify(st, null, 2));

  // All divisions for context
  const { data: divs } = await supabaseAdmin.from('divisions').select('id, name, division_name, courses(code)');
  console.log('=== DIVISIONS ===');
  (divs || []).forEach(d => console.log(` ${d.id} ${d.name} Div${d.division_name} (${d.courses?.code})`));

  console.log('\nDONE');
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
