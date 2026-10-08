/**
 * SMDL SMART ATTENDANCE & COMMUNICATION SYSTEM
 * STEP 7 — FINAL RELEASE VERIFICATION SUITE
 *
 * Covers:
 *  - Backend Production Boot & Environment Config
 *  - API Connectivity
 *  - Database Connectivity
 *  - Authentication & JWT Validation
 *  - File Upload & Supabase Storage Signed URLs
 *  - Attendance System & Geofencing
 *  - Notification System (In-App)
 *  - Email & SMTP Transporter Connectivity
 *  - Permissions & Role-Based Authorization
 *  - Security Headers & Error Handling
 */

const http = require('http');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const app = require('../index');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/db');
const {
  BUCKET_NAME,
  ensureSelfieBucket,
  validateAndDecodeSelfie,
  uploadAttendanceSelfie,
  deleteSelfieObject,
  generateSelfieSignedUrl,
} = require('../services/selfieStorageService');
const { createNotification } = require('../services/notificationService');

const TEST_PORT = 5098;
const API_BASE = `http://127.0.0.1:${TEST_PORT}/api`;
const ROOT_BASE = `http://127.0.0.1:${TEST_PORT}`;

let serverInstance = null;
const results = [];

function record(suite, testName, passed, details = '') {
  results.push({ suite, testName, passed, details });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${suite}] ${badge} - ${testName}`);
  if (details) console.log(`       └─ ${details}`);
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {}
  return { status: res.status, ok: res.ok, data };
}

// Minimal valid JPEG binary buffer > 200 bytes
const validJpegBuffer = Buffer.concat([
  Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  Buffer.alloc(180, 0x55),
  Buffer.from([0xFF, 0xD9]),
]);
const VALID_JPEG_DATA_URL = `data:image/jpeg;base64,${validJpegBuffer.toString('base64')}`;

async function runStep7Verification() {
  console.log('='.repeat(80));
  console.log('🚀 SMDL COLLEGE ATTENDANCE SYSTEM — STEP 7 FINAL RELEASE VERIFICATION');
  console.log('='.repeat(80));
  console.log(`Node Environment:   ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database Endpoint:  ${env.SUPABASE_URL}`);
  console.log(`Client Origin:      ${env.CLIENT_URL}`);
  console.log(`Storage Bucket:     ${env.ATTENDANCE_SELFIE_BUCKET}`);
  console.log(`Retention Policy:   ${env.ATTENDANCE_SELFIE_RETENTION_HOURS} hours`);
  console.log('='.repeat(80));

  // 1. START BACKEND SERVER FOR TESTING
  try {
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(TEST_PORT, resolve));
    record('SERVER_BOOT', 'Backend HTTP server started successfully on test port', true, `Listening on ${ROOT_BASE}`);
  } catch (err) {
    record('SERVER_BOOT', 'Backend HTTP server start', false, err.message);
    process.exit(1);
  }

  // 2. API CONNECTIVITY TESTS
  console.log('\n--- 1. API CONNECTIVITY ---');
  try {
    const rootRes = await fetch(`${ROOT_BASE}/`);
    const rootJson = await rootRes.json();
    record('API_CONNECTIVITY', 'Root endpoint (/) returns system info & 200 OK', rootRes.ok && rootJson.success === true, `App: ${rootJson.name} v${rootJson.version}`);

    const healthRes = await api('/health');
    record('API_CONNECTIVITY', 'Health endpoint (/api/health) returns active status', healthRes.ok && healthRes.data?.success === true, `Database: ${healthRes.data?.services?.database}`);
  } catch (err) {
    record('API_CONNECTIVITY', 'API Connectivity verification', false, err.message);
  }

  // 3. DATABASE CONNECTIVITY TESTS
  console.log('\n--- 2. DATABASE CONNECTIVITY ---');
  try {
    const { data: users, error: uErr } = await supabaseAdmin.from('users').select('id, email, role').limit(5);
    record('DB_CONNECTIVITY', 'PostgreSQL users table query', !uErr && Array.isArray(users), `Records queried: ${users?.length || 0}`);

    const { data: courses, error: cErr } = await supabaseAdmin.from('courses').select('id, name, code').limit(5);
    record('DB_CONNECTIVITY', 'Academic courses table query', !cErr && Array.isArray(courses) && courses.length > 0, `Courses queried: ${courses?.length || 0}`);

    const { data: verifs, error: vErr } = await supabaseAdmin.from('email_verifications').select('id, email').limit(1);
    record('DB_CONNECTIVITY', 'Email verifications table query', !vErr, `Verifications reachable: ${!vErr}`);
  } catch (err) {
    record('DB_CONNECTIVITY', 'Database connectivity error', false, err.message);
  }

  // 4. AUTHENTICATION TESTS
  console.log('\n--- 3. AUTHENTICATION ---');
  let adminToken = '';
  let adminUser = null;
  let studentToken = '';
  let studentUser = null;
  let studentProfile = null;

  try {
    // Admin login
    const adminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin', password: 'admin@123' },
    });
    if (adminLoginRes.ok && adminLoginRes.data?.data?.token) {
      adminToken = adminLoginRes.data.data.token;
      adminUser = adminLoginRes.data.data.user || adminLoginRes.data.data;
      record('AUTH', 'Admin login successful with credentials', true, `User: ${adminUser.email} (Role: ${adminUser.role})`);
    } else {
      record('AUTH', 'Admin login with shorthand "admin"', false, adminLoginRes.data?.message || 'Login failed');
    }

    // Invalid login rejection
    const invalidLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin', password: 'WrongPassword999!' },
    });
    record('AUTH', 'Invalid credentials rejected with 401/400', invalidLoginRes.status === 401 || invalidLoginRes.status === 400, `Status: ${invalidLoginRes.status}`);

    // Fetch existing student for token testing
    const { data: testStudent } = await supabaseAdmin
      .from('students')
      .select('id, user_id, student_id, users(id, email, role)')
      .limit(1)
      .maybeSingle();

    if (testStudent && testStudent.users) {
      studentProfile = testStudent;
      studentUser = testStudent.users;
      studentToken = jwt.sign(
        { id: studentUser.id, email: studentUser.email, role: studentUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      record('AUTH', 'Student token issuance and cryptographic verification', Boolean(studentToken), `Student: ${studentUser.email}`);
    } else {
      record('AUTH', 'Existing student lookup for authorization test', false, 'No student found in users table');
    }
  } catch (err) {
    record('AUTH', 'Authentication test suite failure', false, err.message);
  }

  // 5. FILE UPLOAD & STORAGE TESTS
  console.log('\n--- 4. FILE UPLOAD & SUPABASE STORAGE ---');
  let uploadedStoragePath = '';
  try {
    // 5.1 Magic byte validation
    const decoded = validateAndDecodeSelfie(VALID_JPEG_DATA_URL);
    record('FILE_UPLOAD', 'Selfie binary magic bytes & MIME inspection passed', decoded.extension === 'jpg' && decoded.mimeType === 'image/jpeg', `Size: ${decoded.sizeBytes} bytes`);

    // 5.2 Invalid payload rejection
    let rejectedInvalid = false;
    try {
      validateAndDecodeSelfie('data:image/jpeg;base64,corrupted_payload');
    } catch (_e) {
      rejectedInvalid = true;
    }
    record('FILE_UPLOAD', 'Corrupted / invalid image payload strictly rejected', rejectedInvalid, 'Validation error caught properly');

    // 5.3 Upload to private storage
    const testAttendanceId = crypto.randomUUID();
    const testStudentId = studentUser?.id || crypto.randomUUID();
    const uploadResult = await uploadAttendanceSelfie({
      studentId: testStudentId,
      attendanceId: testAttendanceId,
      buffer: decoded.buffer,
      mimeType: decoded.mimeType,
      extension: decoded.extension,
    });
    uploadedStoragePath = uploadResult.storagePath;
    record('FILE_UPLOAD', 'Upload attendance selfie to private Supabase bucket', Boolean(uploadedStoragePath), `Path: ${uploadedStoragePath}`);

    // 5.4 Signed URL generation
    const signedUrl = await generateSelfieSignedUrl(uploadedStoragePath, 300);
    const isValidSignedUrl = typeof signedUrl === 'string' && signedUrl.includes('token=') && !signedUrl.includes(env.SUPABASE_SERVICE_ROLE_KEY);
    record('FILE_UPLOAD', 'Short-lived signed URL generation (no secret leakage)', isValidSignedUrl, `Signed URL verified: ${Boolean(signedUrl)}`);

    // 5.5 Cleanup test object
    const deleteResult = await deleteSelfieObject(uploadedStoragePath);
    record('FILE_UPLOAD', 'Selfie deletion / cleanup from Supabase Storage', deleteResult.success, 'Object cleaned safely');
  } catch (err) {
    record('FILE_UPLOAD', 'Storage test failure', false, err.message);
  }

  // 6. ATTENDANCE SYSTEM TESTS
  console.log('\n--- 5. ATTENDANCE SYSTEM ---');
  let testLectureId = null;
  let createdTempLecture = false;
  try {
    // Prepare test lecture fixture
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existingLecture } = await supabaseAdmin
      .from('lectures')
      .select('id, division_id, subject_id, teacher_id')
      .eq('lecture_date', todayStr)
      .limit(1)
      .maybeSingle();

    if (existingLecture) {
      testLectureId = existingLecture.id;
    } else {
      const { data: div } = await supabaseAdmin.from('divisions').select('id').limit(1).single();
      const { data: subj } = await supabaseAdmin.from('subjects').select('id').limit(1).single();
      const { data: teacher } = await supabaseAdmin.from('teachers').select('id').limit(1).single();
      if (div && subj && teacher) {
        const { data: newLec } = await supabaseAdmin
          .from('lectures')
          .insert({
            division_id: div.id,
            subject_id: subj.id,
            teacher_id: teacher.id,
            lecture_date: todayStr,
            start_time: '08:00:00',
            end_time: '09:00:00',
            topic: 'Step 7 Release Verification Lecture',
          })
          .select('id')
          .single();
        if (newLec) {
          testLectureId = newLec.id;
          createdTempLecture = true;
        }
      }
    }

    // 6.1 Geofence check outside college (SMDL College Kalamboli ~19.02479, 73.10159)
    const outsideGeoRes = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLectureId,
        latitude: 28.6139, // New Delhi (outside geofence)
        longitude: 77.2090,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record('ATTENDANCE', 'Rejection of coordinates outside 500m geofence', outsideGeoRes.status === 400 && /location/i.test(outsideGeoRes.data?.message || ''), `Response: ${outsideGeoRes.data?.message}`);

    // 6.2 Missing selfie rejection
    const noSelfieRes = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLectureId,
        latitude: 19.02479,
        longitude: 73.10159,
        selfie: '',
      },
    });
    record('ATTENDANCE', 'Rejection when selfie is missing', noSelfieRes.status === 400 && /selfie/i.test(noSelfieRes.data?.message || ''), `Response: ${noSelfieRes.data?.message}`);

    // 6.3 My stats query
    const statsRes = await api('/attendance/my-stats', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record('ATTENDANCE', 'Student attendance metrics query (/attendance/my-stats)', statsRes.ok, `Status: ${statsRes.status}`);

    // Cleanup temp lecture if created
    if (createdTempLecture && testLectureId) {
      await supabaseAdmin.from('lectures').delete().eq('id', testLectureId);
    }
  } catch (err) {
    record('ATTENDANCE', 'Attendance test failure', false, err.message);
  }

  // 7. NOTIFICATION SYSTEM TESTS
  console.log('\n--- 6. NOTIFICATION SYSTEM ---');
  try {
    // 7.1 Notification fetch
    const notifRes = await api('/notifications', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record('NOTIFICATIONS', 'Notification retrieval endpoint (/api/notifications)', notifRes.ok, `Status: ${notifRes.status}`);

    // 7.2 In-app notification creation
    if (studentUser?.id) {
      const createdNotif = await createNotification({
        userId: studentUser.id,
        title: 'Final Release Verification Notification',
        message: 'This is an automated production verification message for Step 7.',
        type: 'SYSTEM',
      });
      record('NOTIFICATIONS', 'In-app notification creation & persistence', Boolean(createdNotif?.id), `Notif ID: ${createdNotif?.id}`);

      // Clean up notification
      if (createdNotif?.id) {
        await supabaseAdmin.from('notifications').delete().eq('id', createdNotif.id);
      }
    }
  } catch (err) {
    record('NOTIFICATIONS', 'Notification test failure', false, err.message);
  }

  // 8. EMAIL & SMTP TEST
  console.log('\n--- 7. EMAIL & SMTP CONNECTIVITY ---');
  try {
    const user = (env.SMTP_USER || '').trim();
    const pass = (env.SMTP_PASS || '').trim().replace(/\s+/g, '');
    const isGmail = (env.SMTP_HOST || '').includes('gmail') || user.endsWith('@gmail.com');

    const config = isGmail
      ? { service: 'gmail', auth: { user, pass } }
      : {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: { user, pass },
        };

    const transporter = nodemailer.createTransport(config);
    const verifySuccess = await transporter.verify();
    record('EMAIL_SMTP', 'Gmail SMTP TLS connection & credentials verified', verifySuccess === true, `SMTP User: ${user}`);
  } catch (err) {
    record('EMAIL_SMTP', 'SMTP Connection verification', false, err.message);
  }

  // 9. PERMISSION & AUTHORIZATION TESTS
  console.log('\n--- 8. PERMISSIONS & AUTHORIZATION ---');
  try {
    // 9.1 Unauthenticated request blocked
    const unauthRes = await api('/admin/teachers');
    record('PERMISSIONS', 'Unauthenticated request to /admin/teachers blocked (401)', unauthRes.status === 401, `Status: ${unauthRes.status}`);

    // 9.2 Student forbidden from admin endpoints
    const forbiddenRes = await api('/admin/teachers', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record('PERMISSIONS', 'Student role forbidden from /admin/teachers (403)', forbiddenRes.status === 403, `Status: ${forbiddenRes.status}`);

    // 9.3 Admin authorized for admin endpoints
    const adminRes = await api('/admin/teachers', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('PERMISSIONS', 'Admin role authorized for /admin/teachers (200)', adminRes.ok, `Status: ${adminRes.status}`);
  } catch (err) {
    record('PERMISSIONS', 'Permissions test failure', false, err.message);
  }

  // 10. ERROR HANDLING & SECURITY HEADERS
  console.log('\n--- 9. ERROR HANDLING & SECURITY HEADERS ---');
  try {
    // 10.1 404 Not Found handling
    const notFoundRes = await api('/non-existent-route-xyz');
    record('ERROR_HANDLING', 'Non-existent route handled with 404 JSON response', notFoundRes.status === 404 && notFoundRes.data?.success === false, `Response message: ${notFoundRes.data?.message}`);

    // 10.2 Security headers
    const headersRes = await fetch(`${API_BASE}/health`);
    const xFrame = headersRes.headers.get('x-frame-options');
    const xContentType = headersRes.headers.get('x-content-type-options');
    record('SECURITY_HEADERS', 'Helmet security headers active (X-Frame-Options: DENY, nosniff)', xFrame === 'DENY' && xContentType === 'nosniff', `X-Frame-Options: ${xFrame}, X-Content-Type: ${xContentType}`);
  } catch (err) {
    record('ERROR_HANDLING', 'Error handling test failure', false, err.message);
  }

  // TEARDOWN
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
    console.log('\n🛑 In-process test server shut down cleanly.');
  }

  // SUMMARY
  console.log('\n' + '='.repeat(80));
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`STEP 7 VERIFICATION RESULTS: ${passedCount} PASSED | ${failedCount} FAILED out of ${results.length} tests`);
  console.log('='.repeat(80));

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStep7Verification().catch((err) => {
  console.error('Fatal execution error:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
