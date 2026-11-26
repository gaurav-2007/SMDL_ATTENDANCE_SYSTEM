const { supabaseAdmin } = require('../config/db');

async function checkRpcFunctions() {
  const candidates = ['run_sql', 'exec_sql', 'execute_sql', 'sql', 'query'];
  for (const name of candidates) {
    try {
      const { data, error } = await supabaseAdmin.rpc(name, { query: 'SELECT 1;', sql: 'SELECT 1;' });
      console.log(`RPC [${name}]:`, data, error?.message);
    } catch (e) {
      console.log(`RPC [${name}] threw:`, e.message);
    }
  }
}

checkRpcFunctions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
