const { syncTodayLectures } = require('../src/services/timetableService');
const { getKolkataDateString } = require('../src/utils/dateUtils');
const { supabaseAdmin } = require('../src/config/db');

async function testNoDuplicates() {
  const today = getKolkataDateString();
  console.log(`Running syncTodayLectures on ${today}...`);
  const res1 = await syncTodayLectures(today);
  console.log('Sync 1 result:', res1);

  const res2 = await syncTodayLectures(today);
  console.log('Sync 2 result:', res2);

  const { count } = await supabaseAdmin
    .from('lectures')
    .select('id', { count: 'exact', head: true })
    .eq('lecture_date', today);

  console.log(`Lecture count for today after consecutive syncs: ${count}`);
  if (res1.inserted === 0 && res2.inserted === 0) {
    console.log('✅ PASS: Exactly ZERO duplicates inserted! Timetable sync is 100% idempotent!');
  } else {
    console.error('❌ FAIL: Non-zero insertions on already-synced schedule!');
    process.exit(1);
  }
}

testNoDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
