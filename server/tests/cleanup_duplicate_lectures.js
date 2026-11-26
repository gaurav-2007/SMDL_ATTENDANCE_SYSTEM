const { supabaseAdmin } = require('../src/config/db');

async function cleanupDuplicates() {
  console.log('🧹 Starting cleanup of duplicate lectures for 2026-11-26...');

  // 1. Fetch all attendance records so we never touch an attended lecture
  const { data: attendanceList } = await supabaseAdmin.from('attendance').select('lecture_id');
  const attendedIds = new Set((attendanceList || []).map(a => a.lecture_id));
  console.log(`🔒 Found ${attendedIds.size} attended lecture IDs that must be strictly preserved.`);

  // 2. Fetch all lectures for today
  const { data: allToday } = await supabaseAdmin
    .from('lectures')
    .select('id, division_id, subject_id, start_time, topic, created_at, semester')
    .eq('lecture_date', '2026-11-26')
    .order('created_at', { ascending: true });

  console.log(`📊 Total lectures for today before cleanup: ${allToday.length}`);

  const seenSlots = new Map();
  const toDeleteIds = [];

  for (const l of allToday) {
    if (attendedIds.has(l.id)) {
      // Must keep!
      continue;
    }

    const key = `${l.division_id}-${l.subject_id}-${l.start_time}`;
    if (!seenSlots.has(key)) {
      // First one is kept as the representative slot!
      seenSlots.set(key, l.id);
    } else {
      // Duplicate without attendance! Mark for deletion
      toDeleteIds.push(l.id);
    }
  }

  console.log(`🗑️ Identified ${toDeleteIds.length} redundant duplicate lectures to delete.`);

  // Delete in batches of 100 to avoid request length limits
  const BATCH_SIZE = 100;
  let deletedCount = 0;
  for (let i = 0; i < toDeleteIds.length; i += BATCH_SIZE) {
    const batch = toDeleteIds.slice(i, i + BATCH_SIZE);
    // Also clean up any notification logs referencing these lectures
    await supabaseAdmin.from('lecture_notification_logs').delete().in('lecture_id', batch);
    const { error: delErr } = await supabaseAdmin.from('lectures').delete().in('id', batch);
    if (delErr) {
      console.error(`Batch ${i / BATCH_SIZE} delete error:`, delErr.message);
    } else {
      deletedCount += batch.length;
      console.log(`Deleted batch: ${deletedCount}/${toDeleteIds.length}`);
    }
  }

  // Verify remaining count
  const { count } = await supabaseAdmin
    .from('lectures')
    .select('id', { count: 'exact', head: true })
    .eq('lecture_date', '2026-11-26');

  console.log(`✅ Cleanup Complete! Remaining clean lectures for today: ${count}`);
}

cleanupDuplicates().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
