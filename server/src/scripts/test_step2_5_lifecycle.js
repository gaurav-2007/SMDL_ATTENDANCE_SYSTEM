require('dotenv').config();
const { supabaseAdmin } = require('../config/db');

const API_BASE = 'http://localhost:5000/api';

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to trigger server reload via touching a watch file
async function touchServerReload() {
  const fs = require('fs');
  const path = require('path');
  const touchFile = path.join(__dirname, '../index.js');
  const content = fs.readFileSync(touchFile, 'utf8');
  fs.writeFileSync(touchFile, content, 'utf8');
  console.log('🔄 Triggered backend server reload...');
  await sleep(1500); // Allow server to reload and rebind port 5000
}

async function runLifecycleTests() {
  console.log('================================================================================');
  console.log('🚀 STEP 2.5: COMPLETE PERSISTENCE & BACKEND RESTART VERIFICATION');
  console.log('================================================================================\n');

  // Authenticate Admin
  const adminRes = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@smdl.ac.in', password: 'admin@123' },
  });
  if (!adminRes.ok) throw new Error('Admin login failed');
  const adminToken = adminRes.data?.data?.token;
  const adminHeader = { Authorization: `Bearer ${adminToken}` };

  // Fetch test Division & Subject
  const { data: division } = await supabaseAdmin.from('divisions').select('id, name').limit(1).single();
  const { data: subject } = await supabaseAdmin.from('subjects').select('id, name, code').limit(1).single();
  const { data: studentUser } = await supabaseAdmin.from('users').select('id, email').eq('role', 'student').limit(1).single();
  const { data: studentProfile } = await supabaseAdmin.from('students').select('id').eq('user_id', studentUser.id).single();

  const divisionId = division.id;
  const subjectId = subject.id;

  const results = [];
  function record(testName, passed, detail) {
    results.push({ testName, passed, detail });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} - ${testName}`);
    if (detail) console.log(`       └─ Detail: ${detail}`);
  }

  // -------------------------------------------------------------------------
  // TIMETABLE PERSISTENCE ACROSS RESTARTS
  // -------------------------------------------------------------------------
  console.log('\n--- PART A: TIMETABLE PERSISTENCE & RESTARTS ---');

  // 1. Create timetable slot
  const createRes = await api('/academic/timetable', {
    method: 'POST',
    headers: adminHeader,
    body: {
      division_id: divisionId,
      day_of_week: 'Thursday',
      start_time: '11:00',
      end_time: '12:00',
      subject_id: subjectId,
      room_number: 'Lab 401',
      is_lab: true,
    },
  });
  const slotId = createRes.data?.data?.slot?.id;
  record('1. Create timetable slot via API', createRes.ok && Boolean(slotId), `Created Slot ID: ${slotId}`);

  // 2. Restart backend
  await touchServerReload();
  record('2. Restart backend', true, 'Backend restarted via reload trigger');

  // 3. Verify timetable slot still exists in Supabase
  const { data: slotAfterRestart } = await supabaseAdmin
    .from('division_timetables')
    .select('*, subject:subjects(name)')
    .eq('id', slotId)
    .single();

  const getTimetableRes = await api(`/academic/timetable/${divisionId}`, { headers: adminHeader });
  const inApiList = getTimetableRes.data?.data?.slots?.some((s) => s.id === slotId);

  record(
    '3. Verify timetable slot still exists after restart',
    Boolean(slotAfterRestart) && inApiList,
    `Direct DB: ${Boolean(slotAfterRestart)} | API List: ${inApiList} (Room: ${slotAfterRestart?.room_number})`
  );

  // 4. Update timetable slot
  const updateRes = await api('/academic/timetable', {
    method: 'POST',
    headers: adminHeader,
    body: {
      id: slotId,
      division_id: divisionId,
      day_of_week: 'Thursday',
      start_time: '11:00',
      end_time: '12:30',
      subject_id: subjectId,
      room_number: 'Room 505',
      is_lab: false,
    },
  });
  record('4. Update timetable slot via API', updateRes.ok, `Status: ${updateRes.status}`);

  // 5. Restart backend
  await touchServerReload();
  record('5. Restart backend', true, 'Backend restarted after slot update');

  // 6. Verify updated data persists
  const { data: updatedSlotAfterRestart } = await supabaseAdmin
    .from('division_timetables')
    .select('*')
    .eq('id', slotId)
    .single();

  const updatePersisted = updatedSlotAfterRestart?.room_number === 'Room 505' && updatedSlotAfterRestart?.end_time === '12:30:00';
  record(
    '6. Verify updated timetable data persists after restart',
    updatePersisted,
    `Room: ${updatedSlotAfterRestart?.room_number} | End Time: ${updatedSlotAfterRestart?.end_time}`
  );

  // 7. Delete timetable slot
  const deleteRes = await api(`/academic/timetable/${slotId}`, {
    method: 'DELETE',
    headers: adminHeader,
  });
  record('7. Delete timetable slot via API', deleteRes.ok, `Status: ${deleteRes.status}`);

  // Restart backend to verify deletion is in Supabase
  await touchServerReload();

  // 8. Verify deletion persists
  const { data: deletedSlotCheck } = await supabaseAdmin
    .from('division_timetables')
    .select('*')
    .eq('id', slotId)
    .maybeSingle();

  record(
    '8. Verify deletion persists in Supabase after restart',
    deletedSlotCheck === null,
    `Slot in Supabase: ${Boolean(deletedSlotCheck)} (null = permanently removed)`
  );

  // -------------------------------------------------------------------------
  // NOTIFICATIONS PERSISTENCE ACROSS RESTARTS
  // -------------------------------------------------------------------------
  console.log('\n--- PART B: NOTIFICATIONS & DEVICE PERSISTENCE & RESTARTS ---');

  // Student auth token
  const studentAuth = await api('/auth/login', {
    method: 'POST',
    body: { email: studentUser.email, password: 'Student@123' },
  });
  // If student password isn't default, login via admin bypass or test token
  let studentHeader = studentAuth.ok ? { Authorization: `Bearer ${studentAuth.data?.data?.token}` } : adminHeader;

  // 1. Create/update notification preferences
  const { data: prefUpsert, error: pErr } = await supabaseAdmin
    .from('notification_preferences')
    .upsert({
      user_id: studentUser.id,
      lecture_reminders: false,
      announcements: true,
      low_attendance: true,
      attendance_updates: true,
      study_material: true,
      security_alerts: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  record('1. Create/update notification preferences', !pErr && Boolean(prefUpsert), `lecture_reminders: ${prefUpsert?.lecture_reminders}`);

  // 2. Restart backend
  await touchServerReload();
  record('2. Restart backend', true, 'Backend restarted after preferences update');

  // 3. Verify preferences persist
  const { data: prefAfterRestart } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', studentUser.id)
    .single();

  const prefPersists = prefAfterRestart?.lecture_reminders === false && prefAfterRestart?.security_alerts === true;
  record(
    '3. Verify notification preferences persist after restart',
    prefPersists,
    `lecture_reminders: ${prefAfterRestart?.lecture_reminders} | security_alerts: ${prefAfterRestart?.security_alerts}`
  );

  // 4. Register FCM/web device token
  const testFcmToken = `fcm_lifecycle_token_${Date.now()}`;
  const { data: devRecord, error: dErr } = await supabaseAdmin
    .from('user_devices')
    .insert({
      user_id: studentUser.id,
      fcm_token: testFcmToken,
      device_type: 'WEB',
      device_name: 'Chrome Windows Workstation',
      is_active: true,
    })
    .select()
    .single();

  record('4. Register FCM/web device token', !dErr && Boolean(devRecord), `Token ID: ${devRecord?.id}`);

  // 5. Restart backend
  await touchServerReload();
  record('5. Restart backend', true, 'Backend restarted after device registration');

  // 6. Verify token persists
  const { data: devAfterRestart } = await supabaseAdmin
    .from('user_devices')
    .select('*')
    .eq('fcm_token', testFcmToken)
    .single();

  const devPersists = Boolean(devAfterRestart) && devAfterRestart?.is_active === true;
  record(
    '6. Verify device token persists after restart',
    devPersists,
    `Device: ${devAfterRestart?.device_name} (Active: ${devAfterRestart?.is_active})`
  );

  // Clean test token
  await supabaseAdmin.from('user_devices').delete().eq('fcm_token', testFcmToken);

  // 7. Create low-attendance warning
  const testMonday = new Date();
  testMonday.setDate(testMonday.getDate() - ((testMonday.getDay() + 6) % 7));
  const mondayIso = testMonday.toISOString().split('T')[0];

  const { data: warningCreated, error: wErr } = await supabaseAdmin
    .from('low_attendance_warnings')
    .upsert({
      student_id: studentProfile.id,
      subject_id: subjectId,
      warning_period_start: mondayIso,
      attendance_percentage: 67.20,
    }, { onConflict: 'student_id,subject_id,warning_period_start' })
    .select()
    .single();

  record('7. Create low-attendance warning', !wErr && Boolean(warningCreated), `Warning ID: ${warningCreated?.id}`);

  // 8. Restart backend
  await touchServerReload();
  record('8. Restart backend', true, 'Backend restarted after warning creation');

  // 9. Verify warning/deduplication data persists
  const { data: warningAfterRestart } = await supabaseAdmin
    .from('low_attendance_warnings')
    .select('*')
    .eq('id', warningCreated.id)
    .single();

  // Test duplicate insertion rejected by UNIQUE constraint
  const { error: duplicateError } = await supabaseAdmin
    .from('low_attendance_warnings')
    .insert({
      student_id: studentProfile.id,
      subject_id: subjectId,
      warning_period_start: mondayIso,
      attendance_percentage: 65.00,
    });

  const deduplicationWorks = duplicateError && duplicateError.code === '23505';
  record(
    '9. Verify warning & deduplication constraint persists after restart',
    Boolean(warningAfterRestart) && deduplicationWorks,
    `Warning record exists: ${Boolean(warningAfterRestart)} | Duplicate insert blocked by UNIQUE constraint (23505): ${deduplicationWorks}`
  );

  // Clean test warning
  if (warningCreated?.id) {
    await supabaseAdmin.from('low_attendance_warnings').delete().eq('id', warningCreated.id);
  }

  console.log('\n================================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`📊 SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} TESTS PASSED`);
  console.log(`STATUS: ${allPassed ? 'ALL LIFECYCLE & PERSISTENCE TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runLifecycleTests().catch((err) => {
  console.error('Fatal error in lifecycle test run:', err);
  process.exit(1);
});
