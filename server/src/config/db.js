const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let rawSupabase = null;
let rawSupabaseAdmin = null;

if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  rawSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  rawSupabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Proxy wrappers provide descriptive errors when credentials are not configured in .env
const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    if (!rawSupabaseAdmin) {
      throw new Error(
        'Supabase database is not connected. Please set valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env'
      );
    }
    const val = rawSupabaseAdmin[prop];
    return typeof val === 'function' ? val.bind(rawSupabaseAdmin) : val;
  },
});

const supabase = new Proxy({}, {
  get(_target, prop) {
    if (!rawSupabase) {
      throw new Error(
        'Supabase database is not connected. Please set valid SUPABASE_URL and SUPABASE_ANON_KEY in server/.env'
      );
    }
    const val = rawSupabase[prop];
    return typeof val === 'function' ? val.bind(rawSupabase) : val;
  },
});

module.exports = { supabase, supabaseAdmin };
