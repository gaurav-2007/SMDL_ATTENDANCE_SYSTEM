const { supabaseAdmin } = require('../src/config/db');

async function clean() {
  // 1. Delete the empty 0-attendance manual duplicate 1933c883
  const { error: delErr } = await supabaseAdmin
    .from('lectures')
    .delete()
    .eq('id', '1933c883-b9a0-4b03-83f0-e3cd6b9e303c');
  console.log('Delete 1933c883 err:', delErr);

  // 2. Update 6cdf76e5 with topic 'Chico (Chek 2 subject)' & ensure teacher is Pooja Chande
  const { error: updErr } = await supabaseAdmin
    .from('lectures')
    .update({
      topic: 'Chico (Chek 2 subject)',
      teacher_id: 'c716f397-da15-47aa-8ec6-f70a694974f2',
    })
    .eq('id', '6cdf76e5-dc8a-48db-bfd9-999d470230f8');
  console.log('Update 6cdf76e5 err:', updErr);

  // 3. Verify attendance on 6cdf76e5
  const { data: atts } = await supabaseAdmin
    .from('attendance')
    .select('id, student_id, status, marked_at')
    .eq('lecture_id', '6cdf76e5-dc8a-48db-bfd9-999d470230f8');
  console.log('Verified attendance records on 6cdf76e5:', atts);
}

clean().catch(console.error);
