/**
 * Tests Backend Startup strictly under NODE_ENV=production
 */

process.env.NODE_ENV = 'production';

// Ensure required env vars are present
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const app = require('../index');
const env = require('../config/env');

async function testProductionBoot() {
  console.log('Testing Production Mode Boot (NODE_ENV=production)...');
  console.log('PORT:', env.PORT);
  console.log('NODE_ENV:', env.NODE_ENV);
  console.log('JWT_SECRET length:', env.JWT_SECRET.length);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5099, resolve));
  console.log('✅ Server successfully listening in PRODUCTION mode on port 5099');

  const res = await fetch('http://127.0.0.1:5099/api/health');
  const data = await res.json();
  console.log('Health response in production:', data);

  if (res.ok && data.success && data.env === 'production') {
    console.log('✅ Production boot test PASSED!');
  } else {
    console.error('❌ Production boot test FAILED!');
    process.exit(1);
  }

  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

testProductionBoot().catch((err) => {
  console.error('Fatal production boot error:', err);
  process.exit(1);
});
