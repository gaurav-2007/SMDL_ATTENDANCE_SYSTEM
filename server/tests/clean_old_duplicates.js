const { supabaseAdmin } = require('../src/config/db');

async function cleanChek2Duplicates() {
  const targetSubjectId = '61cc63ed-43b4-4e38-ac66-eb4666e4de6b';
  const { data: lecs } = await supabaseAdmin
    .from('lectures')
    .select('id, lecture_date, start_time, topic')
    .eq('subject_id', targetSubjectId);

  console.log('Total lectures for Chek 2 subject:', lecs?.length);
  const ids = (lecs || []).map(l => l.id);
  const { data: atts } = await supabaseAdmin
    .from('attendance')
    .select('lecture_id')
    .in('lecture_id', ids);
  const attendedIds = new Set((atts || []).map(a => a.lecture_id));
  console.log('Attended lectures count:', attendedIds.size);

  const toDelete = [];
  const keptDates = new Set();
  for (const l of lecs || []) {
    if (attendedIds.has(l.id)) {
      keptDates.add(l.lecture_date);
      continue;
    }
    if (!keptDates.has(l.lecture_date)) {
      keptDates.add(l.lecture_date); // keep 1 slot per date
      continue;
    }
    toDelete.push(l.id);
  }
  console.log('Unattended extra duplicates to delete:', toDelete.length);
  if (toDelete.length > 0) {
    await supabaseAdmin.from('lectures').delete().in('id', toDelete);
    console.log('Deleted extra duplicates for Chek 2 subject!');
  }
}

cleanChek2Duplicates().catch(console.error);
