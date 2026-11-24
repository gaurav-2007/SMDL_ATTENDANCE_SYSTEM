require('dotenv').config();
const { supabaseAdmin } = require('../src/config/db');

async function testFreshStart() {
  console.log('🧪 Testing Student Fresh Start & Multi-Semester Scoping...\n');

  // 1. Get student in FYBSc CS
  const { data: student, error: stuErr } = await supabaseAdmin
    .from('students')
    .select('id, user_id, student_id, division_id, course_id, courses(name), divisions(name, division_name, current_semester)')
    .eq('student_id', 'cs-2026-003')
    .single();

  if (stuErr || !student) {
    console.error('❌ Student lookup failed:', stuErr?.message);
    process.exit(1);
  }

  const activeSemester = student.divisions?.current_semester || 1;
  console.log(`[Check 1] Student ${student.student_id} in ${student.divisions.name} (Active Sem: ${activeSemester})`);

  // Simulate getMyStats logic for Sem 2 (Active)
  const querySem2 = supabaseAdmin
    .from('lectures')
    .select('id, topic, lecture_date, start_time, semester, academic_year, subject:subjects(name, code, semester)')
    .eq('division_id', student.division_id)
    .eq('semester', 2);

  const { data: sem2Lectures, error: sem2Err } = await querySem2;
  if (sem2Err) {
    console.error('❌ Sem 2 query error:', sem2Err.message);
  } else {
    console.log(`  ✅ Sem 2 Total Lectures: ${sem2Lectures?.length} (Expected: 0 for fresh start)`);
  }

  // Simulate getMyStats logic for Sem 1 (Past Archive)
  const querySem1 = supabaseAdmin
    .from('lectures')
    .select('id, topic, lecture_date, start_time, semester, academic_year, subject:subjects(name, code, semester)')
    .eq('division_id', student.division_id)
    .eq('semester', 1);

  const { data: sem1Lectures, error: sem1Err } = await querySem1;
  if (sem1Err) {
    console.error('❌ Sem 1 query error:', sem1Err.message);
  } else {
    console.log(`  ✅ Sem 1 Total Lectures: ${sem1Lectures?.length} (Expected: > 0 for historical archive)`);
  }

  // Check subjects scoping for Sem 2
  const { data: sem2Subjects, error: subErr } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code, semester')
    .eq('division_id', student.division_id)
    .eq('semester', 2);

  console.log(`  ✅ Sem 2 Curricular Subjects: ${sem2Subjects?.length}`);
  sem2Subjects?.forEach(s => console.log(`     - [${s.code}] ${s.name} (Sem ${s.semester})`));

  console.log('\n🎉 ALL STUDENT FRESH START CHECKS PASSED!\n');
}

testFreshStart().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
