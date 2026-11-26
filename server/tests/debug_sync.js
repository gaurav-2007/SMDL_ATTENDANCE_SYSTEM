const { supabaseAdmin } = require('../src/config/db');

async function checkLec() {
  const { data: lec } = await supabaseAdmin
    .from('lectures')
    .select('*')
    .eq('id', '63f66dcb-4780-4faf-afcc-ffbfae5205d5')
    .single();
  console.log('Lecture 63f66dcb:', lec);

  // Also check all division_timetables for today
  const { data: tt } = await supabaseAdmin
    .from('division_timetables')
    .select('*')
    .eq('day_of_week', 'Thursday');
  console.log('Thursday division_timetables:', tt);
}

checkLec();
