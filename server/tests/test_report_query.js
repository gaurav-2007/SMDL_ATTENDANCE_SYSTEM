const { supabaseAdmin } = require('../src/config/db');

async function testReport() {
  console.log('Testing getSubjectStudentAttendanceReport queries...');

  // 1. Get teacher
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, department, user_id')
    .limit(1)
    .single();
  console.log('Teacher:', teacher);

  // 2. Available subjects
  const { data: availableSubjects, error: subErr } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code, division_id, divisions:divisions(id, name, division_name, course_id, courses:courses(name))');
  console.log('subErr:', subErr);
  console.log('availableSubjects count:', availableSubjects?.length);

  // 3. Test subject lookup
  const targetSubjectId = availableSubjects[0]?.id;
  const { data: subjectData, error: subLookupErr } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code, division_id, divisions:divisions(id, name, division_name, course_id, courses:courses(name))')
    .eq('id', targetSubjectId)
    .single();
  console.log('subLookupErr:', subLookupErr);
  console.log('subjectData:', subjectData);

  // 4. Test students query
  const targetDivisionId = subjectData.division_id;
  console.log('targetDivisionId:', targetDivisionId);

  let studentsQuery = supabaseAdmin
    .from('students')
    .select(`
      id,
      student_id,
      division_id,
      user_id,
      users:users(id, full_name, email, phone, status),
      divisions:divisions(id, name, division_name),
      courses:courses(id, name, code)
    `);
  if (targetDivisionId) {
    studentsQuery = studentsQuery.eq('division_id', targetDivisionId);
  }
  const { data: rawStudents, error: studErr } = await studentsQuery;
  console.log('studErr:', studErr);
  console.log('rawStudents count:', rawStudents?.length);

  // 5. Test with division_id = null or what if subjectData.division_id is null?
  const nullDivSubjects = availableSubjects.filter(s => !s.division_id);
  console.log('Subjects with null division_id count:', nullDivSubjects.length);
  if (nullDivSubjects.length > 0) {
    console.log('Sample subject with null division_id:', nullDivSubjects[0]);
  }
}

testReport().catch(console.error);
