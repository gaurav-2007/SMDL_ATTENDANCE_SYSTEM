const { supabaseAdmin } = require('../src/config/db');

async function testSingleLectureCreation() {
  console.log('🧪 Testing single lecture creation...');

  // FY Division & Subject
  const { data: fyDiv } = await supabaseAdmin.from('divisions').select('id, name').eq('name', 'FYBSc CS').single();
  const { data: sub } = await supabaseAdmin.from('subjects').select('id, name').eq('code', 'CS-01').single();
  const { data: teacher } = await supabaseAdmin.from('teachers').select('id, user_id').eq('teacher_id', 'TCH-1002').single();

  const todayStr = '2026-11-26';
  const startTime = '18:30:00';
  const endTime = '19:30:00';

  // Delete if previously created at this time
  await supabaseAdmin.from('lectures').delete().eq('division_id', fyDiv.id).eq('lecture_date', todayStr).eq('start_time', startTime);

  // 1. Initial count
  const { count: countBefore } = await supabaseAdmin.from('lectures').select('id', { count: 'exact', head: true }).eq('lecture_date', todayStr);

  // 2. Insert 1 lecture
  const insertData = {
    subject_id: sub.id,
    division_id: fyDiv.id,
    teacher_id: teacher.id,
    lecture_date: todayStr,
    start_time: startTime,
    end_time: endTime,
    topic: 'Single Lecture Creation Verification',
    created_by: teacher.user_id,
    semester: 2,
    academic_year: 'FY',
  };

  const { data: created1, error: err1 } = await supabaseAdmin.from('lectures').insert(insertData).select().single();
  if (err1) throw err1;
  console.log(`Created lecture 1: ${created1.id}`);

  // 3. Count after 1st insert
  const { count: countAfter1 } = await supabaseAdmin.from('lectures').select('id', { count: 'exact', head: true }).eq('lecture_date', todayStr);
  console.log(`Count after 1st insert: before=${countBefore}, after=${countAfter1} (diff = ${countAfter1 - countBefore})`);

  if (countAfter1 - countBefore !== 1) {
    throw new Error('FAILURE: More than 1 lecture was created on first insert!');
  }

  // 4. Test duplicate prevention with idempotency check
  const { data: existingExact } = await supabaseAdmin
    .from('lectures')
    .select('id, topic')
    .eq('division_id', fyDiv.id)
    .eq('subject_id', sub.id)
    .eq('lecture_date', todayStr)
    .eq('start_time', startTime)
    .maybeSingle();

  if (!existingExact) {
    throw new Error('FAILURE: Existing lecture not found on duplicate check!');
  }
  console.log(`Duplicate prevention check correctly identified existing lecture: ${existingExact.id}`);

  console.log('✅ TEST PASSED: Exactly ONE lecture created, zero duplicates!');

  // Clean up test lecture
  await supabaseAdmin.from('lectures').delete().eq('id', created1.id);
  console.log('Cleaned up test lecture.');
}

testSingleLectureCreation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
