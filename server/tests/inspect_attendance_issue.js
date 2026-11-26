const { supabaseAdmin } = require('../src/config/db');

async function testGetAttendance() {
  const lectureId = '6cdf76e5-dc8a-48db-bfd9-999d470230f8';
  
  // 1. Get lecture with division
  const { data: lecture } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, subject_id, teacher_id, topic, lecture_date, start_time, end_time, semester, academic_year, subject:subjects(id, name, code, semester), division:divisions(id, name, division_name, current_semester)')
    .eq('id', lectureId)
    .maybeSingle();

  // 2. Get students in division
  const { data: divisionStudents } = await supabaseAdmin
    .from('students')
    .select('id, student_id, users(full_name, email, phone)')
    .eq('division_id', lecture.division_id);

  // 3. Attendance records
  const { data: attendanceRecords } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('lecture_id', lectureId);

  const attMap = new Map((attendanceRecords || []).map((a) => [a.student_id, a]));

  const roster = (divisionStudents || []).map((s) => {
    const att = attMap.get(s.id);
    return {
      roll_number: s.student_id,
      full_name: s.users?.full_name,
      status: att?.status || 'ABSENT',
      marked_at: att?.marked_at || null,
    };
  });

  console.log('Roster count:', roster.length);
  console.log('Present count:', roster.filter(r => r.status === 'PRESENT').length);
  console.log('Roster preview:', roster);
}

testGetAttendance().catch(console.error);
