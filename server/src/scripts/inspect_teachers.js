const { supabaseAdmin } = require('../config/db');

async function checkTeachers() {
  const { data: teachers, error } = await supabaseAdmin.from('teachers').select('*');
  console.log('Teachers error:', error);
  console.log('Teachers:', teachers);
}

checkTeachers();
