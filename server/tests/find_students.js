const { supabaseAdmin } = require('../src/config/db');

async function findStudents() {
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, student_id, user_id, division_id, users(id, full_name, email)')
    .eq('division_id', '32a9ed78-5b3a-4b1a-87c9-3f1489bbe61b');
  console.log('Students in FYBSc CS:', JSON.stringify(students, null, 2));
}

findStudents();
