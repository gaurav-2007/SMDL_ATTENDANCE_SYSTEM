const { supabaseAdmin } = require('../src/config/db');
const { syncTodayLectures } = require('../src/services/timetableService');

async function testTeacherLiveAttendance() {
  console.log('=== TEST TEACHER LIVE ATTENDANCE ===');
  const lectureId = '6cdf76e5-dc8a-48db-bfd9-999d470230f8';

  // 1. Check lecture
  const { data: lec, error: lecErr } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, subject_id, teacher_id, topic, start_time, end_time, semester, lecture_date')
    .eq('id', lectureId)
    .single();
  console.log('Lecture in DB:', lec);
  if (!lec) throw new Error('Lecture 6cdf76e5 not found');

  // 2. Check attendance records for this lecture
  const { data: attRecords, error: attErr } = await supabaseAdmin
    .from('attendance')
    .select('id, student_id, status, marked_at, source')
    .eq('lecture_id', lectureId);
  console.log('Attendance records count for lecture:', attRecords?.length);
  console.log('Attendance records:', attRecords);

  const presentStudent = attRecords?.find(a => a.status === 'PRESENT');
  if (!presentStudent) {
    throw new Error('Expected at least 1 student to be marked PRESENT');
  }

  // 3. Check student profile
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, student_id, users(full_name, email)')
    .eq('id', presentStudent.student_id)
    .single();
  console.log('Present student profile:', student);

  // 4. Test timetable sync idempotency
  const syncRes = await syncTodayLectures('2026-11-26');
  console.log('Timetable sync result:', syncRes);
  if (syncRes.inserted !== 0) {
    throw new Error(`Expected 0 inserted, got ${syncRes.inserted}`);
  }

  console.log('\n✅ ALL CHECKS PASSED: Teacher will see student attendance as PRESENT and no duplicate lectures are created!');
}

testTeacherLiveAttendance().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
