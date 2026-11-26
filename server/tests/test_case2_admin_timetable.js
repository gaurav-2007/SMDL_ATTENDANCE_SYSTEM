const { supabaseAdmin } = require('../src/config/db');
const { syncTodayLectures } = require('../src/services/timetableService');
const { getKolkataDateString, getKolkataDayName } = require('../src/utils/dateUtils');

async function runTestCase2() {
  console.log('====================================================');
  console.log('🧪 RUNNING TEST CASE 2: Admin Timetable Sync FY Sem 2');
  console.log('====================================================');

  try {
    const todayStr = getKolkataDateString();
    const dayName = getKolkataDayName(todayStr);
    console.log(`📅 Today is: ${dayName}, ${todayStr}`);

    // 1. Get FY Division
    const { data: fyDiv } = await supabaseAdmin
      .from('divisions')
      .select('id, name, division_name, current_semester')
      .eq('name', 'FYBSc CS')
      .single();

    console.log(`✅ FY Division: ${fyDiv.name} Div ${fyDiv.division_name}, Active Sem: ${fyDiv.current_semester}`);
    if (fyDiv.current_semester !== 2) {
      throw new Error(`Expected FYBSc CS current_semester to be 2, got ${fyDiv.current_semester}`);
    }

    // 2. Get Subject: CS-02 (Chek 2 subject, Semester 2)
    const { data: subSem2 } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, semester')
      .eq('code', 'CS-02')
      .single();

    console.log(`✅ Subject: ${subSem2.name} (${subSem2.code}), Semester: ${subSem2.semester}`);

    // 3. Get Teacher: Pooja Chande
    const { data: poojaUser } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email')
      .eq('email', 'pooja.chande@smdl.ac.in')
      .single();

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id, teacher_id, user_id')
      .eq('user_id', poojaUser.id)
      .single();

    console.log(`✅ Teacher: ${poojaUser.full_name} (${teacher.teacher_id}), ID: ${teacher.id}`);

    // 4. Create or replace a Timetable Slot for Today in division_timetables
    // Let's set time slot to 16:00 - 17:00
    const slotStartTime = '16:00:00';
    const slotEndTime = '17:00:00';

    // Delete any existing slot at this exact time for clean test
    await supabaseAdmin
      .from('division_timetables')
      .delete()
      .eq('division_id', fyDiv.id)
      .eq('day_of_week', dayName)
      .eq('start_time', slotStartTime);

    // Also delete any existing lecture at this slot for today so sync creates it fresh
    await supabaseAdmin
      .from('lectures')
      .delete()
      .eq('division_id', fyDiv.id)
      .eq('lecture_date', todayStr)
      .eq('start_time', slotStartTime);

    console.log(`📝 Inserting Timetable slot into division_timetables for ${dayName} ${slotStartTime}-${slotEndTime}...`);
    const { data: insertedSlot, error: slotErr } = await supabaseAdmin
      .from('division_timetables')
      .insert({
        division_id: fyDiv.id,
        subject_id: subSem2.id,
        teacher_id: teacher.id,
        day_of_week: dayName,
        start_time: slotStartTime,
        end_time: slotEndTime,
        room_number: 'Room 204',
        is_lab: false,
        semester: 2,
        academic_year: '2026-27',
      })
      .select()
      .single();

    if (slotErr) {
      throw new Error('Failed to insert timetable slot: ' + slotErr.message);
    }
    console.log(`✅ Timetable Slot Created in DB! ID: ${insertedSlot.id}, Semester: ${insertedSlot.semester}`);

    // 5. Trigger syncTodayLectures
    console.log('⚡ Triggering syncTodayLectures()...');
    const syncResult = await syncTodayLectures(todayStr);
    console.log('✅ syncTodayLectures result:', syncResult);

    // 6. Verify Lecture Generated in DB
    const { data: generatedLec, error: lecErr } = await supabaseAdmin
      .from('lectures')
      .select(`
        id,
        lecture_date,
        start_time,
        end_time,
        topic,
        semester,
        academic_year,
        teacher_id,
        subject:subjects(name, code, semester),
        division:divisions(name, division_name, current_semester)
      `)
      .eq('division_id', fyDiv.id)
      .eq('lecture_date', todayStr)
      .eq('start_time', slotStartTime)
      .maybeSingle();

    if (lecErr || !generatedLec) {
      throw new Error('FAILURE: Timetable lecture was not generated! ' + (lecErr?.message || ''));
    }
    console.log(`✅ Automated Timetable Lecture Verified in DB! ID: ${generatedLec.id}`);
    console.log(`   Semester: ${generatedLec.semester}, Academic Year: ${generatedLec.academic_year}`);
    console.log(`   Subject: ${generatedLec.subject.name} (${generatedLec.subject.code}), Subject Sem: ${generatedLec.subject.semester}`);
    console.log(`   Assigned Teacher ID: ${generatedLec.teacher_id} (Matches Pooja Chande: ${generatedLec.teacher_id === teacher.id})`);

    if (generatedLec.semester !== 2) {
      throw new Error(`FAILURE: Expected generated lecture semester = 2, got ${generatedLec.semester}`);
    }

    // 7. Check Teacher Pooja Chande's Schedule for Today
    console.log('🔍 Checking Pooja Chande today schedule visibility...');
    const { data: teacherLectures } = await supabaseAdmin
      .from('lectures')
      .select('id, start_time, end_time, semester, subject:subjects(name, code)')
      .eq('teacher_id', teacher.id)
      .eq('lecture_date', todayStr);

    const foundInSchedule = (teacherLectures || []).some(l => l.id === generatedLec.id);
    if (!foundInSchedule) {
      throw new Error('FAILURE: Generated lecture not found on teacher schedule!');
    }
    console.log(`✅ Lecture is confirmed VISIBLE on Teacher Pooja Chande's schedule for today!`);

    // 8. Student CS-2026-002 Marks Attendance
    const { data: studentRec } = await supabaseAdmin
      .from('students')
      .select('id, student_id, division_id')
      .eq('student_id', 'CS-2026-002')
      .single();

    console.log(`📍 Marking attendance for student (Roll: ${studentRec.student_id})...`);
    const { data: attRecord, error: attErr } = await supabaseAdmin
      .from('attendance')
      .insert({
        lecture_id: generatedLec.id,
        student_id: studentRec.id,
        status: 'PRESENT',
        marked_at: new Date().toISOString(),
        location_verified: true,
        source: 'MOBILE_APP',
        notes: 'Test Case 2 Automated Verification',
      })
      .select()
      .single();

    if (attErr) {
      throw new Error('Failed to mark student attendance: ' + attErr.message);
    }
    console.log(`✅ Attendance Marked Successfully! Record ID: ${attRecord.id}, Status: ${attRecord.status}`);

    // 9. Verify Lecture Attendance Roster
    const { data: roster } = await supabaseAdmin
      .from('attendance')
      .select('id, student_id, status')
      .eq('lecture_id', generatedLec.id);

    const studentInRoster = (roster || []).find(r => r.student_id === studentRec.id);
    if (!studentInRoster || studentInRoster.status !== 'PRESENT') {
      throw new Error('FAILURE: Student not recorded as PRESENT on lecture roster!');
    }
    console.log(`✅ Student ${studentRec.student_id} confirmed PRESENT on lecture roster!`);

    console.log('====================================================');
    console.log('🎉 TEST CASE 2 PASSED WITH 100% SUCCESS!');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ TEST CASE 2 FAILED:', err.message);
    process.exit(1);
  }
}

runTestCase2();
