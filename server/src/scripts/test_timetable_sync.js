const { supabaseAdmin } = require('../config/db');
const { syncTodayLectures, getAcademicEntities } = require('../services/timetableService');

async function testSync() {
  console.log('Testing timetable auto-sync for today (Thursday)...');
  const { division } = await getAcademicEntities();
  console.log('FYBSc CS division:', division?.id);

  // Clean old lectures for today in FYBSc CS so we get fresh ones with correct teachers
  await supabaseAdmin
    .from('lectures')
    .delete()
    .eq('division_id', division.id)
    .eq('lecture_date', '2026-09-24');

  const result = await syncTodayLectures('2026-09-24');
  console.log('Sync Result:', result);

  const { data: lectures } = await supabaseAdmin
    .from('lectures')
    .select(`
      id,
      start_time,
      end_time,
      topic,
      teacher:teachers(id, teacher_id, user:users!teachers_user_id_fkey(full_name)),
      subject:subjects(name, code)
    `)
    .eq('lecture_date', '2026-09-24')
    .eq('division_id', division.id)
    .order('start_time', { ascending: true });

  console.log('\n--- TODAY SCHEDULED LECTURES (FYBSc CS) ---');
  (lectures || []).forEach((l) => {
    console.log(`[${l.start_time.slice(0, 5)} - ${l.end_time.slice(0, 5)}] ${l.subject?.code} - ${l.subject?.name} | Teacher: ${l.teacher?.user?.full_name}`);
  });
}

testSync().catch(console.error);
