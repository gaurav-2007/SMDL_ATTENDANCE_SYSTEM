const { supabaseAdmin } = require('../src/config/db');

async function checkDuplicates() {
  const { data: lecs } = await supabaseAdmin
    .from('lectures')
    .select('id, subject_id, start_time, topic, semester, created_at')
    .eq('lecture_date', '2026-11-26');

  const groups = {};
  for (const l of lecs) {
    const key = `${l.subject_id}-${l.start_time}-${l.topic}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }

  console.log('Unique lecture slot groups today:');
  for (const [k, arr] of Object.entries(groups)) {
    console.log(`- Slot: "${k}" has ${arr.length} duplicates! First created at ${arr[0].created_at}, last at ${arr[arr.length - 1].created_at}`);
  }
}

checkDuplicates();
