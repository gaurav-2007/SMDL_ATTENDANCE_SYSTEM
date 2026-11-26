const { supabaseAdmin } = require('../config/db');

async function alignDivisions() {
  console.log('🔄 Aligning division semesters for academic year separation...');

  // Update SYBSc CS -> current_semester = 3
  const { data: sy, error: syErr } = await supabaseAdmin
    .from('divisions')
    .update({ current_semester: 3 })
    .eq('name', 'SYBSc CS')
    .select();

  if (syErr) console.error('Error updating SYBSc CS:', syErr.message);
  else console.log('✅ SYBSc CS aligned to Semester 3:', sy);

  // Update TYBSc CS -> current_semester = 5
  const { data: ty, error: tyErr } = await supabaseAdmin
    .from('divisions')
    .update({ current_semester: 5 })
    .eq('name', 'TYBSc CS')
    .select();

  if (tyErr) console.error('Error updating TYBSc CS:', tyErr.message);
  else console.log('✅ TYBSc CS aligned to Semester 5:', ty);

  // Fetch all divisions to verify
  const { data: all } = await supabaseAdmin
    .from('divisions')
    .select('id, name, division_name, current_semester');
  console.log('Current Divisions Status:', all);

  process.exit(0);
}

alignDivisions().catch(err => {
  console.error(err);
  process.exit(1);
});
