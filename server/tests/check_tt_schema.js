const { supabaseAdmin } = require('../src/config/db');

async function checkTimetableSchema() {
  const { data, error } = await supabaseAdmin.from('division_timetables').select('*').limit(1);
  console.log('division_timetables sample:', data, error);
}

checkTimetableSchema();
