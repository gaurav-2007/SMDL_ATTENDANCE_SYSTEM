/**
 * SMDL SMART ATTENDANCE & COMMUNICATION SYSTEM
 * STEP 8 — GEOFENCE CONFIGURATION MANAGEMENT VERIFICATION SUITE
 */

const http = require('http');
const crypto = require('crypto');
const app = require('../index');
const { supabaseAdmin } = require('../config/db');
const { signToken } = require('../utils/jwt');

const TEST_PORT = 5092;
const API_BASE = `http://127.0.0.1:${TEST_PORT}/api`;

let serverInstance = null;
const results = [];

function record(name, passed, details = '') {
  results.push({ name, passed, details });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${badge} - ${name}`);
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

// Haversine helper to compute offset coordinates at specific distances
function getOffsetCoords(baseLat, baseLon, distanceMeters) {
  // Approximate latitude degree in meters ~ 111,320m
  const dLat = distanceMeters / 111320;
  return {
    latitude: baseLat + dLat,
    longitude: baseLon,
  };
}

async function runStep8Tests() {
  console.log('='.repeat(80));
  console.log('🧭 STEP 8 — GEOFENCE CONFIGURATION MANAGEMENT VERIFICATION SUITE');
  console.log('='.repeat(80));

  // 1. Start test server
  serverInstance = http.createServer(app);
  await new Promise((resolve) => serverInstance.listen(TEST_PORT, resolve));
  console.log(`📡 In-process test server listening on ${API_BASE}\n`);

  let adminToken = '';
  let studentToken = '';
  let teacherToken = '';
  let studentUser = null;
  let testLecture = null;

  try {
    // Authenticate Admin
    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin', password: 'admin@123' },
    });
    adminToken = adminLogin.data?.data?.token;
    record('Setup: Admin authenticated', Boolean(adminToken), 'Token acquired');

    // Fetch existing Student & create token
    const { data: studentRec } = await supabaseAdmin
      .from('students')
      .select('id, user_id, student_id, users(id, email, role, status)')
      .limit(1)
      .single();

    studentUser = studentRec.users;
    studentToken = signToken(studentUser);
    record('Setup: Student authenticated', Boolean(studentToken), studentUser.email);

    // Fetch existing Teacher & create token
    const { data: teacherRec } = await supabaseAdmin
      .from('teachers')
      .select('id, user_id')
      .limit(1)
      .maybeSingle();

    let teacherUser = null;
    if (teacherRec?.user_id) {
      const { data: tUser } = await supabaseAdmin.from('users').select('*').eq('id', teacherRec.user_id).single();
      teacherUser = tUser;
    } else {
      const { data: tUser } = await supabaseAdmin.from('users').select('*').eq('role', 'teacher').limit(1).maybeSingle();
      teacherUser = tUser;
    }

    teacherToken = signToken(teacherUser);
    record('Setup: Teacher authenticated', Boolean(teacherToken), teacherUser?.email || 'Teacher Token');

    // Create or find a test lecture
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existingLecture } = await supabaseAdmin
      .from('lectures')
      .select('id, division_id, subject_id, teacher_id')
      .eq('lecture_date', todayStr)
      .limit(1)
      .maybeSingle();

    if (existingLecture) {
      testLecture = existingLecture;
    } else {
      const { data: div } = await supabaseAdmin.from('divisions').select('id').limit(1).single();
      const { data: subj } = await supabaseAdmin.from('subjects').select('id').limit(1).single();
      const { data: newLec, error: lecErr } = await supabaseAdmin
        .from('lectures')
        .insert({
          division_id: div.id,
          subject_id: subj.id,
          teacher_id: teacherRec?.id,
          lecture_date: todayStr,
          start_time: '08:00:00',
          end_time: '09:00:00',
          topic: 'Step 8 Geofence Verification Lecture',
        })
        .select()
        .single();
      if (lecErr) console.error('Lecture insert error:', lecErr);
      testLecture = newLec;
    }

    record('Setup: Test lecture fixture ready', Boolean(testLecture?.id), `Lecture ID: ${testLecture?.id}`);

    // Ensure clean attendance state for student on this lecture
    if (testLecture?.id) {
      await supabaseAdmin.from('attendance').delete().eq('lecture_id', testLecture.id);
    }

    const baseLat = 19.02479;
    const baseLon = 73.10159;

    // --- TEST 1: Initialize Database with 100m Radius ---
    await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        college_latitude: String(baseLat),
        college_longitude: String(baseLon),
        geofence_radius_meters: '100',
      },
    });

    const getInitCfg = await api('/attendance/geofence-config', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record(
      '1. Initial DB state reflects 100m radius & coordinates',
      getInitCfg.data?.data?.geofence_radius_meters === 100 &&
        parseFloat(getInitCfg.data?.data?.college_latitude) === baseLat,
      `Radius: ${getInitCfg.data?.data?.geofence_radius_meters}m, Lat: ${getInitCfg.data?.data?.college_latitude}`
    );

    // --- TEST 2: Student inside 100m (at 40m offset) accepted ---
    const inside40 = getOffsetCoords(baseLat, baseLon, 40);
    const insideRes = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: inside40.latitude,
        longitude: inside40.longitude,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record(
      '2. Student inside 100m (at 40m) accepted',
      insideRes.status === 201,
      `Status: ${insideRes.status}`
    );

    // Clean up student attendance record so they can mark again
    await supabaseAdmin.from('attendance').delete().eq('lecture_id', testLecture.id);

    // --- TEST 3: Student outside 100m (at 150m offset) rejected with dynamic message ---
    const outside150 = getOffsetCoords(baseLat, baseLon, 150);
    const outside150Res = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: outside150.latitude,
        longitude: outside150.longitude,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record(
      '3. Student at 150m rejected when radius is 100m (citing Max: 100m)',
      outside150Res.status === 400 && outside150Res.data?.message?.includes('100m'),
      `Response: ${outside150Res.data?.message}`
    );

    // --- TEST 4: Admin changes radius to 200m ---
    const changeTo200 = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { geofence_radius_meters: '200' },
    });
    record(
      '4. Admin updates radius to 200m via PUT /admin/config',
      changeTo200.status === 200,
      `Status: ${changeTo200.status}`
    );

    // --- TEST 5: Student at 150m now accepted under 200m radius ---
    const inside200Res = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: outside150.latitude,
        longitude: outside150.longitude,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record(
      '5. Student at 150m accepted under updated 200m radius',
      inside200Res.status === 201,
      `Status: ${inside200Res.status}`
    );

    await supabaseAdmin.from('attendance').delete().eq('lecture_id', testLecture.id);

    // --- TEST 6: Student at 250m rejected citing Max: 200m ---
    const outside250 = getOffsetCoords(baseLat, baseLon, 250);
    const outside250Res = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: outside250.latitude,
        longitude: outside250.longitude,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record(
      '6. Student at 250m rejected when radius is 200m (citing Max: 200m)',
      outside250Res.status === 400 && outside250Res.data?.message?.includes('200m'),
      `Response: ${outside250Res.data?.message}`
    );

    // --- TEST 7: Admin changes coordinates to new location ---
    const newTestLat = 19.03000;
    const newTestLon = 73.11000;
    const changeCoords = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        college_latitude: String(newTestLat),
        college_longitude: String(newTestLon),
        geofence_radius_meters: '100',
      },
    });
    record(
      '7. Admin updates college coordinates to new location',
      changeCoords.status === 200,
      `Status: ${changeCoords.status}`
    );

    // --- TEST 8: New coordinates immediately active via API ---
    const checkActiveCoords = await api('/attendance/geofence-config', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record(
      '8. New coordinates immediately active without server restart',
      parseFloat(checkActiveCoords.data?.data?.college_latitude) === newTestLat &&
        parseFloat(checkActiveCoords.data?.data?.college_longitude) === newTestLon,
      `Lat: ${checkActiveCoords.data?.data?.college_latitude}, Lon: ${checkActiveCoords.data?.data?.college_longitude}`
    );

    // --- TEST 9: Student at OLD coordinates rejected ---
    const oldLocRes = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: baseLat,
        longitude: baseLon,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record(
      '9. Student at old coordinates rejected under new location',
      oldLocRes.status === 400 && /Location verification failed/i.test(oldLocRes.data?.message || ''),
      `Response: ${oldLocRes.data?.message}`
    );

    // --- TEST 10: Student at NEW coordinates accepted ---
    const atNewLocRes = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: newTestLat,
        longitude: newTestLon,
        selfie: VALID_JPEG_DATA_URL,
      },
    });
    record(
      '10. Student at new coordinates accepted',
      atNewLocRes.status === 201,
      `Status: ${atNewLocRes.status}`
    );

    await supabaseAdmin.from('attendance').delete().eq('lecture_id', testLecture.id);

    // --- TEST 11: Invalid latitude (> 90) rejected with HTTP 400 ---
    const badLatRes = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { college_latitude: '95.5' },
    });
    record(
      '11. Invalid latitude (> 90) rejected with HTTP 400',
      badLatRes.status === 400,
      `Status: ${badLatRes.status}, Message: ${badLatRes.data?.message}`
    );

    // --- TEST 12: Invalid longitude (< -180) rejected with HTTP 400 ---
    const badLonRes = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { college_longitude: '-195.0' },
    });
    record(
      '12. Invalid longitude (< -180) rejected with HTTP 400',
      badLonRes.status === 400,
      `Status: ${badLonRes.status}, Message: ${badLonRes.data?.message}`
    );

    // --- TEST 13: Invalid radius (0, negative, or non-numeric) rejected with HTTP 400 ---
    const badRad0 = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { geofence_radius_meters: '0' },
    });
    const badRadNeg = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { geofence_radius_meters: '-50' },
    });
    const badRadStr = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { geofence_radius_meters: 'invalid_radius' },
    });
    record(
      '13. Non-positive or non-numeric radius rejected with HTTP 400',
      badRad0.status === 400 && badRadNeg.status === 400 && badRadStr.status === 400,
      `Rad=0: ${badRad0.status}, Rad=-50: ${badRadNeg.status}, Rad=str: ${badRadStr.status}`
    );

    // --- TEST 14: Student forbidden from modifying config (HTTP 403) ---
    const studentPut = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { geofence_radius_meters: '500' },
    });
    record(
      '14. Student forbidden from modifying geofence config (HTTP 403)',
      studentPut.status === 403,
      `Status: ${studentPut.status}`
    );

    // --- TEST 15: Teacher forbidden from modifying config (HTTP 403) ---
    const teacherPut = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: { geofence_radius_meters: '500' },
    });
    record(
      '15. Teacher forbidden from modifying geofence config (HTTP 403)',
      teacherPut.status === 403,
      `Status: ${teacherPut.status}`
    );

    // --- TEST 16: Unauthenticated request to config blocked (HTTP 401) ---
    const unauthPut = await api('/admin/config', {
      method: 'PUT',
      body: { geofence_radius_meters: '500' },
    });
    record(
      '16. Unauthenticated request to config blocked (HTTP 401)',
      unauthPut.status === 401,
      `Status: ${unauthPut.status}`
    );

    // --- TEST 17: Read-only GET /api/attendance/geofence-config available to student/teacher ---
    const studentGetGeo = await api('/attendance/geofence-config', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const teacherGetGeo = await api('/attendance/geofence-config', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    record(
      '17. Authenticated students & teachers can read geofence settings',
      studentGetGeo.status === 200 && teacherGetGeo.status === 200,
      `Student: ${studentGetGeo.status}, Teacher: ${teacherGetGeo.status}`
    );

    // --- TEST 18: Reset to desired production defaults (Lat: 19.02479, Lon: 73.10159, Radius: 100m) ---
    const resetRes = await api('/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        college_latitude: String(baseLat),
        college_longitude: String(baseLon),
        geofence_radius_meters: '100',
      },
    });
    const verifyReset = await api('/attendance/geofence-config', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record(
      '18. Restored to desired production settings (19.02479, 73.10159, 100m)',
      resetRes.status === 200 &&
        parseFloat(verifyReset.data?.data?.college_latitude) === baseLat &&
        verifyReset.data?.data?.geofence_radius_meters === 100,
      `Radius: ${verifyReset.data?.data?.geofence_radius_meters}m`
    );

    // --- TEST 19: Selfie validation & private storage integrity preserved ---
    const noSelfieRes = await api('/attendance/mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        lecture_id: testLecture.id,
        latitude: baseLat,
        longitude: baseLon,
        selfie: '',
      },
    });
    record(
      '19. Mandatory camera selfie verification remains strictly enforced',
      noSelfieRes.status === 400 && /selfie/i.test(noSelfieRes.data?.message || ''),
      `Message: ${noSelfieRes.data?.message}`
    );

    // --- TEST 20: Regression test on existing endpoints ---
    const healthRes = await api('/health');
    const myStatsRes = await api('/attendance/my-stats', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record(
      '20. Overall regression test on existing endpoints (/health, /my-stats)',
      healthRes.status === 200 && myStatsRes.status === 200,
      `Health: ${healthRes.status}, Stats: ${myStatsRes.status}`
    );

    // Clean up test lecture
    if (testLecture?.id) {
      await supabaseAdmin.from('attendance').delete().eq('lecture_id', testLecture.id);
      await supabaseAdmin.from('lectures').delete().eq('id', testLecture.id);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    record('Suite Execution', false, err.message);
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
      console.log('\n🛑 In-process test server shut down cleanly.');
    }
  }

  console.log('\n' + '='.repeat(80));
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`STEP 8 RESULTS: ${passedCount} PASSED | ${failedCount} FAILED out of ${results.length} tests`);
  console.log('='.repeat(80));

  if (failedCount > 0) process.exit(1);
  else process.exit(0);
}

runStep8Tests().catch((err) => {
  console.error('Fatal execution error:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
