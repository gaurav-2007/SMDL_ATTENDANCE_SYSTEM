require('dotenv').config();
const { supabaseAdmin } = require('../config/db');

async function waitForSchema() {
  const maxAttempts = 15;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabaseAdmin.from('division_timetables').select('id').limit(1);
    if (!error) {
      console.log(`🎉 SUCCESS! Table division_timetables detected on attempt ${attempt}!`);
      process.exit(0);
    }
    console.log(`[Attempt ${attempt}/${maxAttempts}] Table not yet ready (${error.code}). Waiting 2s...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('⏰ Timeout waiting for table creation.');
  process.exit(1);
}

waitForSchema();
