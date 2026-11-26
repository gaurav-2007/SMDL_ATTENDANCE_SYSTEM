const { supabaseAdmin } = require('../src/config/db');

async function testAttendanceChunkingAndCleanup() {
  const targetSubjectId = 'af09c507-f585-4a8d-a088-044687f8420e';
  
  // 1. Check if any of the 2026-11-24 lectures have attendance
  const { data: lecsNov24 } = await supabaseAdmin
    .from('lectures')
    .select('id')
    .eq('subject_id', targetSubjectId)
    .eq('lecture_date', '2026-11-24');
  
  const nov24Ids = (lecsNov24 || []).map(l => l.id);
  console.log('Nov 24 lectures count:', nov24Ids.length);

  // Chunk to check attendance
  const chunkSize = 80;
  let attendedNov24Ids = new Set();
  for (let i = 0; i < nov24Ids.length; i += chunkSize) {
    const chunk = nov24Ids.slice(i, i + chunkSize);
    const { data: atts } = await supabaseAdmin
      .from('attendance')
      .select('lecture_id')
      .in('lecture_id', chunk);
    (atts || []).forEach(a => attendedNov24Ids.add(a.lecture_id));
  }
  console.log('Nov 24 attended lectures count:', attendedNov24Ids.size);

  // If attendedNov24Ids is 0 or small, delete the unattended ones!
  const toDelete = nov24Ids.filter(id => !attendedNov24Ids.has(id));
  console.log('Nov 24 unattended duplicate lectures to delete:', toDelete.length);
}

testAttendanceChunkingAndCleanup().catch(console.error);
