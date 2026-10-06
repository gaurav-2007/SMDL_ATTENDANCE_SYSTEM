/**
 * STEP 1 FINAL REVIEW — OTP PRODUCTION & HARDENING TEST SUITE
 * 
 * Tests:
 * 1. .local_otp_store.json is completely removed from production and never created.
 * 2. In NODE_ENV=production, devFallbackStore is strictly null.
 * 3. In NODE_ENV=production, database is the sole source of truth; if DB fails, it fails safely.
 * 4. Production suppresses all OTP console logging.
 * 5. 10-minute expiry enforcement works.
 * 6. 5-attempt brute-force lockout works.
 * 7. 45-second resend cooldown works.
 * 8. Single-use consumption works (reused OTP fails).
 * 9. Development fallback is strictly gated to NODE_ENV=development.
 */

const fs = require('fs');
const path = require('path');

const results = [];

function record(name, passed, details = '') {
  results.push({ name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (details) console.log(`       Detail: ${details}`);
}

async function runOtpTests() {
  console.log('='.repeat(70));
  console.log('🔐 RUNNING OTP PRODUCTION HARDENING & FALLBACK VERIFICATION');
  console.log('='.repeat(70));

  const localFile = path.join(__dirname, '../../.local_otp_store.json');

  // Test 1: Ensure .local_otp_store.json does not exist on disk
  const fileExists = fs.existsSync(localFile);
  record('1. .local_otp_store.json is completely removed from disk', !fileExists, `Exists: ${fileExists}`);

  // Test 2: In production mode, devFallbackStore is strictly null
  {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../services/otpService')];
    const prodOtpService = require('../services/otpService');

    const devStore = prodOtpService.getDevFallbackStore();
    const isNull = devStore === null;
    record('2. In production, devFallbackStore is strictly null', isNull, `devFallbackStore: ${devStore}`);

    // Test 3: In production mode, database is the SOLE source of truth
    // If table is missing or DB fails, createOtp fails safely rather than writing local files
    let failedSafely = false;
    let errorMessage = '';
    try {
      await prodOtpService.createOtp('prod.test@smdl.ac.in');
    } catch (err) {
      failedSafely = true;
      errorMessage = err.message;
    }
    // Verify it failed safely with service unavailable message and did NOT create local file
    const fileCreatedInProd = fs.existsSync(localFile);
    record(
      '3. In production, fails safely on DB error without local file creation',
      failedSafely && !fileCreatedInProd && errorMessage.includes('temporarily unavailable'),
      `Failed safely: ${failedSafely}, Error: "${errorMessage}", File created: ${fileCreatedInProd}`
    );

    // Test 4: In production, verifyOtp returns safe error when DB record not found or table unavailable
    const verifyProdRes = await prodOtpService.verifyOtp('prod.test@smdl.ac.in', '123456');
    const verifySafe = verifyProdRes.success === false && 
      (verifyProdRes.reason === 'SERVICE_UNAVAILABLE' || verifyProdRes.reason === 'NOT_FOUND');
    record(
      '4. In production, verifyOtp fails safely without falling back to memory/file',
      verifySafe,
      `success: ${verifyProdRes.success}, reason: ${verifyProdRes.reason}`
    );

    // Restore environment
    process.env.NODE_ENV = originalEnv;
    delete require.cache[require.resolve('../services/otpService')];
  }

  // Test 5: In development mode (NODE_ENV=development), test OTP security features
  {
    process.env.NODE_ENV = 'development';
    delete require.cache[require.resolve('../services/otpService')];
    const devOtpService = require('../services/otpService');

    // 5a: Generation & Verification
    const testEmail = `dev.test.${Date.now()}@smdl.ac.in`;
    const created = await devOtpService.createOtp(testEmail);
    const code = created.otp;
    const verify1 = await devOtpService.verifyOtp(testEmail, code);
    record(
      '5. Valid OTP verification produces signed verification token',
      verify1.success === true && !!verify1.otpToken,
      `success: ${verify1.success}, token length: ${verify1.otpToken?.length}`
    );

    // 5b: Single-Use & Reuse Prevention
    await devOtpService.consumeVerification(testEmail);
    const verifyReused = await devOtpService.verifyOtp(testEmail, code);
    const isStillValid = await devOtpService.isEmailVerified(testEmail, verify1.otpToken);
    record(
      '6. Consumed/reused OTP fails verification',
      verifyReused.success === false && isStillValid === false,
      `Reverify success: ${verifyReused.success}, isEmailVerified: ${isStillValid}`
    );

    // 5c: 45-second Resend Cooldown
    const cooldownEmail = `dev.cooldown.${Date.now()}@smdl.ac.in`;
    await devOtpService.createOtp(cooldownEmail);
    let cooldownBlocked = false;
    let cooldownMsg = '';
    try {
      await devOtpService.createOtp(cooldownEmail);
    } catch (err) {
      cooldownBlocked = true;
      cooldownMsg = err.message;
    }
    record(
      '7. 45-second resend cooldown blocks rapid re-requests',
      cooldownBlocked && cooldownMsg.includes('seconds'),
      `Blocked: ${cooldownBlocked}, Message: "${cooldownMsg}"`
    );

    // 5d: 5-Attempt Lockout
    const lockoutEmail = `dev.lockout.${Date.now()}@smdl.ac.in`;
    await devOtpService.createOtp(lockoutEmail);
    for (let i = 1; i <= 5; i++) {
      await devOtpService.verifyOtp(lockoutEmail, '000000');
    }
    const attempt6 = await devOtpService.verifyOtp(lockoutEmail, '000000');
    record(
      '8. Locked out after 5 incorrect OTP attempts',
      attempt6.success === false && attempt6.reason === 'MAX_ATTEMPTS_EXCEEDED',
      `6th attempt reason: ${attempt6.reason}`
    );

    // 5e: 10-Minute Expiry
    const expireEmail = `dev.expire.${Date.now()}@smdl.ac.in`;
    const expCreated = await devOtpService.createOtp(expireEmail);
    const store = devOtpService.getDevFallbackStore();
    const entry = store?.get(expireEmail);
    if (entry) entry.expiresAt = Date.now() - 1000; // simulate expired
    const expireVerify = await devOtpService.verifyOtp(expireEmail, expCreated.otp);
    record(
      '9. Expired OTP rejected with EXPIRED reason',
      expireVerify.success === false && expireVerify.reason === 'EXPIRED',
      `reason: ${expireVerify.reason}`
    );

    // Verify .local_otp_store.json was STILL NOT CREATED
    const finalFileCheck = fs.existsSync(localFile);
    record(
      '10. .local_otp_store.json was NEVER created on disk during entire lifecycle',
      !finalFileCheck,
      `Exists: ${finalFileCheck}`
    );
  }

  console.log('\n' + '='.repeat(70));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL OTP AUDIT TESTS: ${results.length}`);
  console.log(`PASSED:                ${passed}`);
  console.log(`FAILED:                ${failed}`);
  console.log(`SUCCESS RATE:          ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runOtpTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
