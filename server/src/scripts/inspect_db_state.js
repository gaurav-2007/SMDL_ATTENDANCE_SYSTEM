const { supabaseAdmin } = require('../config/db');

async function inspect() {
  try {
    const { data: div } = await supabaseAdmin.from('divisions').select('*').limit(1);
    console.log('Division keys:', div && div[0] ? Object.keys(div[0]) : 'None');
    console.log('Division sample:', div && div[0]);

    const { data: allDivs } = await supabaseAdmin.from('divisions').select('id, name, division_name, current_semester');
    console.log('All divisions:', allDivs);

    const { data: sub } = await supabaseAdmin.from('subjects').select('*').limit(1);
    console.log('Subject keys:', sub && sub[0] ? Object.keys(sub[0]) : 'None');
    console.log('Subject sample:', sub && sub[0]);

    process.exit(0);
  } catch (err) {
    console.error('Inspect error:', err);
    process.exit(1);
  }
}

inspect();
