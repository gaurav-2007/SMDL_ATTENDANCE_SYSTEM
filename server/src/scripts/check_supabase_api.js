require('dotenv').config();
const { supabaseAdmin } = require('../config/db');

async function test() {
  const { data } = await supabaseAdmin.from('notifications').select('*').limit(1);
  if (data && data[0]) {
    console.log('notifications columns:', Object.keys(data[0]));
  }
  const { data: sc } = await supabaseAdmin.from('system_config').select('*').limit(1);
  if (sc && sc[0]) {
    console.log('system_config columns:', Object.keys(sc[0]));
  }
}

test();
