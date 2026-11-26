const { supabaseAdmin } = require('../src/config/db');

async function runTestCase1() {
  console.log('====================================================');
  console.log('🧪 RUNNING TEST CASE 1: Teacher Pooja Chande FY Sem 2');
  console.log('====================================================');

  try {
    // 1. Get Teacher Pooja Chande
    const { data: poojaUser, error: uErr } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, status')
      .eq('email', 'pooja.chande@smdl.ac.in')
      .single();

    if (uErr || !poojaUser) {
      throw new Error('Pooja Chande user record not found: ' + (uErr?.message || ''));
    }
    console.log(`✅ Teacher Identified: ${poojaUser.full_name} (${poojaUser.email}), User ID: ${poojaUser.id}`);

    const { data: teacherProfile } = await supabaseAdmin
      .from('teachers')
      .select('id, teacher_id')
      .eq('user_id', poojaUser.id)
      .single();

    console.log(`✅ Teacher Profile: ID: ${teacherProfile.id}, Code: ${teacherProfile.teacher_id}`);

    // 2. Identify FY Division & Subject for Sem 2
    const { data: fyDiv } = await supabaseAdmin
      .from('divisions')
      .select('id, name, division_name, current_semester')
      .eq('name', 'FYBSc CS')
      .single();
    console.log(`✅ Division: ${fyDiv.name} Div ${fyDiv.division_name}, Active Sem: ${fyDiv.current_semester}`);

    const { data: subSem2 } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, semester, division_id')
      .eq('code', 'CS-01') // just chek sub1, Semester 2
      .single();
    console.log(`✅ Subject: ${subSem2.name} (${subSem2.code}), Semester: ${subSem2.semester}`);

    // 3. Create Lecture as Teacher Pooja Chande
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startHour = String(now.getHours()).padStart(2, '0');
    const startMin = String(now.getMinutes()).padStart(2, '0');
    const startTimeStr = `${startHour}:${startMin}:00`;
    const endMinutes = now.getHours() * 60 + now.getMinutes() + 60;
    const endHour = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
    const endMinStr = String(endMinutes % 60).padStart(2, '0');
    const endTimeStr = `${endHour}:${endMinStr}:00`;

    const insertPayload = {
      subject_id: subSem2.id,
      division_id: fyDiv.id,
      teacher_id: teacherProfile.id,
      lecture_date: todayStr,
      start_time: startTimeStr,
      end_time: endTimeStr,
      topic: 'Test Case 1: Verification Lecture FY Sem 2',
      created_by: poojaUser.id,
      semester: 2,
      academic_year: 'FY',
    };

    console.log('📝 Creating lecture in DB:', insertPayload);
    const { data: newLecture, error: lecErr } = await supabaseAdmin
      .from('lectures')
      .insert(insertPayload)
      .select(`
        id,
        lecture_date,
        start_time,
        end_time,
        topic,
        semester,
        academic_year,
        subject:subjects(id, name, code, semester),
        division:divisions(id, name, division_name, current_semester)
      `)
      .single();

    if (lecErr) {
      throw new Error('Failed to create lecture: ' + lecErr.message);
    }
    console.log(`✅ Lecture Created Successfully! ID: ${newLecture.id}`);
    console.log(`   Semester: ${newLecture.semester}, Academic Year: ${newLecture.academic_year}`);
    console.log(`   Subject: ${newLecture.subject.name} (Sem ${newLecture.subject.semester})`);
    console.log(`   Division: ${newLecture.division.name} (Current Sem: ${newLecture.division.current_semester})`);

    // Verify semester is strictly 2
    if (newLecture.semester !== 2) {
      throw new Error(`FAILURE: Expected lecture.semester = 2, got: ${newLecture.semester}`);
    }

    // 4. Test Student: CS-2026-002 ("Test account")
    const { data: studentRec } = await supabaseAdmin
      .from('students')
      .select('id, student_id, division_id, users(id, full_name, email)')
      .eq('student_id', 'CS-2026-002')
      .single();

    console.log(`✅ Student Identified: ${studentRec.users?.full_name} (${studentRec.student_id}), PK: ${studentRec.id}`);

    // 5. Mark Attendance for Student
    console.log('📍 Marking attendance for student in this lecture...');
    const { data: attRecord, error: attErr } = await supabaseAdmin
      .from('attendance')
      .insert({
        lecture_id: newLecture.id,
        student_id: studentRec.id,
        status: 'PRESENT',
        marked_at: new Date().toISOString(),
        location_verified: true,
        source: 'MOBILE_APP',
        notes: 'Test Case 1 Automated Verification',
      })
      .select()
      .single();

    if (attErr) {
      throw new Error('Failed to mark attendance: ' + attErr.message);
    }
    console.log(`✅ Attendance Marked Successfully! Record ID: ${attRecord.id}, Status: ${attRecord.status}`);

    // 6. Verify Attendance Roster
    const { data: rosterAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id, student_id, status, marked_at')
      .eq('lecture_id', newLecture.id);

    console.log(`✅ Attendance Roster Count for Lecture: ${rosterAttendance.length}`);
    const studentEntry = rosterAttendance.find(a => a.student_id === studentRec.id);
    if (!studentEntry || studentEntry.status !== 'PRESENT') {
      throw new Error('FAILURE: Student attendance entry missing or not PRESENT in roster!');
    }
    console.log(`✅ Student ${studentRec.student_id} confirmed PRESENT in lecture roster!`);

    // 7. Verify Student's Semester 2 Stats
    const { data: sem2Lectures } = await supabaseAdmin
      .from('lectures')
      .select('id')
      .eq('division_id', fyDiv.id)
      .eq('semester', 2);

    const sem2LectureIds = (sem2Lectures || []).map(l => l.id);
    const { data: studentSem2Attendance } = await supabaseAdmin
      .from('attendance')
      .select('id, status')
      .eq('student_id', studentRec.id)
      .in('lecture_id', sem2LectureIds)
      .eq('status', 'PRESENT');

    console.log(`✅ Student Semester 2 Total Lectures: ${sem2LectureIds.length}, Attended: ${studentSem2Attendance.length}`);
    const pct = ((studentSem2Attendance.length / sem2LectureIds.length) * 100).toFixed(1);
    console.log(`✅ Student Semester 2 Attendance Percentage: ${pct}%`);

    console.log('====================================================');
    console.log('🎉 TEST CASE 1 PASSED WITH 100% SUCCESS!');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ TEST CASE 1 FAILED:', err.message);
    process.exit(1);
  }
}

runTestCase1();
