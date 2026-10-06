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

async function runPersistenceTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING SUPABASE DATABASE PERSISTENCE TESTS (STEP 2.5)');
  console.log('================================================================================\n');

  // 1. Verify schema tables exist
  console.log('--- 1. DATABASE SCHEMA VERIFICATION ---');
  const requiredTables = [
    'division_timetables',
    'timetable',
    'attendance_records',
    'user_devices',
    'notification_preferences',
    'low_attendance_warnings',
    'lecture_notification_logs',
    'password_reset_tokens',
    'email_verifications',
  ];

  let missingTables = [];
  for (const t of requiredTables) {
    const { error } = await supabaseAdmin.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ Table ${t.padEnd(28)}: MISSING (${error.code}) - ${error.message}`);
      missingTables.push(t);
    } else {
      console.log(`✅ Table ${t.padEnd(28)}: EXISTS in Supabase`);
    }
  }

  if (missingTables.length > 0) {
    console.error('\n⚠️ Pending migrations must be applied to Supabase before running persistence tests.');
    console.error(`Missing tables: ${missingTables.join(', ')}`);
    console.error('Run server/supabase/migrations/APPLY_PENDING_MIGRATIONS.sql in the Supabase SQL Editor.\n');
    return { success: false, missingTables };
  }

  console.log('\nAll required tables verified in Supabase!\n');

  // 2. Authenticate Admin and Student
  console.log('--- 2. AUTHENTICATION SETUP ---');
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@smdl.ac.in', password: 'admin@123' },
  });
  const adminToken = adminLogin.data?.data?.token;
  const adminHeader = { Authorization: `Bearer ${adminToken}` };
  console.log('Admin authenticated:', Boolean(adminToken));

  const { data: studentUser } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('role', 'student')
    .limit(1)
    .single();

  const { data: studentRecord } = await supabaseAdmin
    .from('students')
    .select('id, division_id')
    .eq('user_id', studentUser.id)
    .single();

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('id, name')
    .limit(1)
    .single();

  const { data: subject } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code')
    .limit(1)
    .single();

  const testDivisionId = division.id;
  const testSubjectId = subject.id;

  // 3. Timetable Persistence Tests
  console.log('\n--- 3. TIMETABLE PERSISTENCE TESTS ---');

  // Step 3.1: Create timetable slot via API
  const createSlotRes = await api('/academic/timetable', {
    method: 'POST',
    headers: adminHeader,
    body: {
      division_id: testDivisionId,
      day_of_week: 'Wednesday',
      start_time: '14:00',
      end_time: '15:00',
      subject_id: testSubjectId,
      room_number: 'Lab 301',
      is_lab: true,
    },
  });
  console.log('3.1 Create timetable slot API response:', createSlotRes.status, createSlotRes.data?.data?.slot?.id);
  const createdSlotId = createSlotRes.data?.data?.slot?.id;

  // Step 3.2: Verify timetable slot directly in Supabase table
  const { data: dbSlotAfterCreate, error: dbSlotErr } = await supabaseAdmin
    .from('division_timetables')
    .select('*')
    .eq('id', createdSlotId)
    .maybeSingle();

  const persistsInDb = !dbSlotErr && dbSlotAfterCreate && dbSlotAfterCreate.id === createdSlotId;
  console.log('3.2 Slot persists in Supabase division_timetables:', persistsInDb);

  // Step 3.3: Update timetable slot
  const updateSlotRes = await api('/academic/timetable', {
    method: 'POST',
    headers: adminHeader,
    body: {
      id: createdSlotId,
      division_id: testDivisionId,
      day_of_week: 'Wednesday',
      start_time: '14:00',
      end_time: '15:30',
      subject_id: testSubjectId,
      room_number: 'Lab 302',
      is_lab: true,
    },
  });
  console.log('3.3 Update timetable slot API response:', updateSlotRes.status);

  // Step 3.4: Verify updated data directly in Supabase
  const { data: dbSlotAfterUpdate } = await supabaseAdmin
    .from('division_timetables')
    .select('*')
    .eq('id', createdSlotId)
    .maybeSingle();

  const updatePersists = dbSlotAfterUpdate?.room_number === 'Lab 302' && dbSlotAfterUpdate?.end_time === '15:30:00';
  console.log('3.4 Updated values persist in Supabase:', updatePersists, `(room: ${dbSlotAfterUpdate?.room_number})`);

  // Step 3.5: Delete timetable slot
  const deleteSlotRes = await api(`/academic/timetable/${createdSlotId}`, {
    method: 'DELETE',
    headers: adminHeader,
  });
  console.log('3.5 Delete timetable slot API response:', deleteSlotRes.status);

  // Step 3.6: Verify deletion in Supabase
  const { data: dbSlotAfterDelete } = await supabaseAdmin
    .from('division_timetables')
    .select('*')
    .eq('id', createdSlotId)
    .maybeSingle();

  const deletionPersists = dbSlotAfterDelete === null;
  console.log('3.6 Deletion persists in Supabase (record removed):', deletionPersists);

  // 4. Notifications & Preferences Persistence Tests
  console.log('\n--- 4. NOTIFICATIONS & DEVICE PERSISTENCE TESTS ---');

  // Step 4.1: Notification preferences persistence
  const { data: upsertPref, error: prefErr } = await supabaseAdmin
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

  console.log('4.1 Notification preferences upsert in Supabase:', !prefErr, `lecture_reminders: ${upsertPref?.lecture_reminders}`);

  const { data: dbPrefRead } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', studentUser.id)
    .single();

  const prefPersists = dbPrefRead?.lecture_reminders === false;
  console.log('4.2 Preferences persist in Supabase table:', prefPersists);

  // Step 4.2: User device token persistence
  const testFcmToken = `fcm_test_${Date.now()}`;
  const { data: dbDevice, error: devErr } = await supabaseAdmin
    .from('user_devices')
    .insert({
      user_id: studentUser.id,
      fcm_token: testFcmToken,
      device_type: 'WEB',
      device_name: 'Chrome Persistence Test',
    })
    .select()
    .single();

  console.log('4.3 User device token insert in Supabase:', !devErr, dbDevice?.id);

  const { data: dbDeviceRead } = await supabaseAdmin
    .from('user_devices')
    .select('*')
    .eq('fcm_token', testFcmToken)
    .single();

  const tokenPersists = Boolean(dbDeviceRead);
  console.log('4.4 Device token persists in Supabase table:', tokenPersists);

  // Clean test token
  await supabaseAdmin.from('user_devices').delete().eq('fcm_token', testFcmToken);

  // Step 4.3: Low attendance warning deduplication persistence
  const testMonday = new Date();
  testMonday.setDate(testMonday.getDate() - ((testMonday.getDay() + 6) % 7));
  const mondayIso = testMonday.toISOString().split('T')[0];

  const { data: warnRec, error: warnErr } = await supabaseAdmin
    .from('low_attendance_warnings')
    .upsert({
      student_id: studentRecord.id,
      subject_id: testSubjectId,
      warning_period_start: mondayIso,
      attendance_percentage: 64.50,
    }, { onConflict: 'student_id,subject_id,warning_period_start' })
    .select()
    .single();

  console.log('4.5 Low attendance warning persisted in Supabase:', !warnErr, warnRec?.id);

  // Verify duplicate prevention constraint (unique student_id, subject_id, warning_period_start)
  const { error: dupErr } = await supabaseAdmin
    .from('low_attendance_warnings')
    .insert({
      student_id: studentRecord.id,
      subject_id: testSubjectId,
      warning_period_start: mondayIso,
      attendance_percentage: 60.00,
    });

  const uniqueConstraintWorks = dupErr && dupErr.code === '23505';
  console.log('4.6 Duplicate weekly warning rejected by UNIQUE constraint:', uniqueConstraintWorks);

  // Clean test warning
  if (warnRec?.id) {
    await supabaseAdmin.from('low_attendance_warnings').delete().eq('id', warnRec.id);
  }

  console.log('\n================================================================================');
  console.log('🎉 PERSISTENCE TEST SUMMARY:');
  console.log(`- Timetable slot creation persists: ${persistsInDb ? 'PASS' : 'FAIL'}`);
  console.log(`- Timetable slot update persists:   ${updatePersists ? 'PASS' : 'FAIL'}`);
  console.log(`- Timetable slot deletion persists: ${deletionPersists ? 'PASS' : 'FAIL'}`);
  console.log(`- Notification preferences persist: ${prefPersists ? 'PASS' : 'FAIL'}`);
  console.log(`- Device token persists:            ${tokenPersists ? 'PASS' : 'FAIL'}`);
  console.log(`- Warning deduplication persists:   ${uniqueConstraintWorks ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  return {
    success: persistsInDb && updatePersists && deletionPersists && prefPersists && tokenPersists && uniqueConstraintWorks,
  };
}

runPersistenceTests();
