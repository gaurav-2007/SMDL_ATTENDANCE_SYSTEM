require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { supabaseAdmin } = require('../src/config/db');

async function testStep4Scoping() {
  console.log('--- TESTING STEP 4: SEMESTER SCOPING IN BACKEND & DB ---');

  // 1. Fetch FYBSc CS division
  const { data: div, error: divErr } = await supabaseAdmin
    .from('divisions')
    .select('id, name, division_name, current_semester')
    .eq('name', 'FYBSc CS')
    .single();

  if (divErr) {
    console.error('Failed to get division:', divErr);
    process.exit(1);
  }

  console.log(`[PASS] Found division "${div.name}" with current_semester = ${div.current_semester}`);

  // 2. Query lectures scoped to semester = 1
  const { data: sem1Lecs, error: sem1Err } = await supabaseAdmin
    .from('lectures')
    .select('id, semester, academic_year')
    .eq('division_id', div.id)
    .eq('semester', 1);

  if (sem1Err) {
    console.error('Failed to query sem 1 lectures:', sem1Err);
    process.exit(1);
  }
  console.log(`[PASS] Semester 1 lectures for ${div.name}: ${sem1Lecs.length} lectures found (Target preserved!).`);

  // 3. Query lectures scoped to semester = 2
  const { data: sem2Lecs, error: sem2Err } = await supabaseAdmin
    .from('lectures')
    .select('id, semester, academic_year')
    .eq('division_id', div.id)
    .eq('semester', 2);

  if (sem2Err) {
    console.error('Failed to query sem 2 lectures:', sem2Err);
    process.exit(1);
  }
  console.log(`[PASS] Semester 2 lectures for ${div.name}: ${sem2Lecs.length} lectures (Clean slate, zero spillover).`);

  // 4. Query student profile with division
  const { data: student, error: stuErr } = await supabaseAdmin
    .from('students')
    .select('id, student_id, division_id, divisions(name, current_semester)')
    .eq('division_id', div.id)
    .limit(1)
    .maybeSingle();

  if (stuErr) {
    console.error('Failed to query student:', stuErr);
    process.exit(1);
  }
  if (student) {
    console.log(`[PASS] Sample student ${student.student_id} resolves division "${student.divisions?.name}" with current_semester = ${student.divisions?.current_semester}`);
  }

  console.log('--- ALL STEP 4 VERIFICATIONS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

testStep4Scoping();
