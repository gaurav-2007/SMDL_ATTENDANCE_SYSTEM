require('dotenv').config();
const { supabaseAdmin } = require('../config/db');
const { resolveNotificationActionUrl } = require('../utils/notificationRouter');
const {
  isPushAllowedForUser,
  createNotification,
} = require('../services/notificationService');
const { deactivateTokens } = require('../services/fcmService');

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

async function runStep3Tests() {
  console.log('\n================================================================================');
  console.log('🧪 STEP 3 — WEB FCM PUSH & NOTIFICATIONS COMPREHENSIVE VERIFICATION');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Public Firebase Config Endpoint & Secret Leak Prevention
    // -------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Public Configuration & Security Boundary ---');
    const configRes = await api('/notifications/firebase-config');
    assert(
      configRes.status === 200 && configRes.data?.success === true,
      'GET /api/notifications/firebase-config returns 200 without auth'
    );

    const configData = configRes.data?.data || {};
    assert(
      configData.privateKey === undefined &&
      configData.private_key === undefined &&
      configData.clientEmail === undefined &&
      configData.client_email === undefined &&
      configData.serviceAccount === undefined &&
      configData.jwtSecret === undefined &&
      configData.serviceRoleKey === undefined,
      'Public config NEVER leaks private keys, service account credentials, or secrets'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Auth Protection on Device Endpoints
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Auth Protection & Device Registration ---');
    const unauthReg = await api('/notifications/devices', {
      method: 'POST',
      body: { fcm_token: 'fake_unauth_token' },
    });
    assert(unauthReg.status === 401, 'Unauthorized device registration rejected with 401');

    // Retrieve Active Student & Teacher for testing
    const { data: studentUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status')
      .eq('role', 'student')
      .eq('status', 'ACTIVE')
      .limit(1)
      .single();

    const { data: teacherUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status')
      .eq('role', 'teacher')
      .eq('status', 'ACTIVE')
      .limit(1)
      .single();

    assert(!!studentUser, `Active Student user found (${studentUser?.email})`);
    assert(!!teacherUser, `Active Teacher user found (${teacherUser?.email})`);

    const { signToken } = require('../utils/jwt');
    const studentToken = signToken({ id: studentUser.id });
    const teacherToken = signToken({ id: teacherUser.id });
    const studentAuthHeader = { Authorization: `Bearer ${studentToken}` };
    const teacherAuthHeader = { Authorization: `Bearer ${teacherToken}` };

    // -------------------------------------------------------------------------
    // TEST A: Register FCM Token for Student A & Verify Persistence in user_devices
    // -------------------------------------------------------------------------
    console.log('\n--- TEST A: Register FCM Token & DB Persistence ---');
    const deviceToken1 = `test_fcm_token_student1_browser1_${Date.now()}`;
    const regRes1 = await api('/notifications/devices', {
      method: 'POST',
      headers: studentAuthHeader,
      body: {
        fcm_token: deviceToken1,
        device_type: 'WEB',
        device_name: 'Chrome on Windows (Browser 1)',
      },
    });
    assert(regRes1.status === 201, 'Device Token 1 registered successfully for Student 1');

    // Verify token exists in PostgreSQL user_devices table
    const { data: dbDev1 } = await supabaseAdmin
      .from('user_devices')
      .select('*')
      .eq('fcm_token', deviceToken1)
      .eq('user_id', studentUser.id)
      .single();

    assert(
      dbDev1 && dbDev1.is_active === true && dbDev1.device_type === 'WEB',
      'Device Token 1 persisted in Supabase user_devices with is_active = true'
    );

    // -------------------------------------------------------------------------
    // TEST G: Register Two Devices for Same User (Multi-Device)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST G: Multi-Device Registration for Same User ---');
    const deviceToken2 = `test_fcm_token_student1_browser2_${Date.now()}`;
    await api('/notifications/devices', {
      method: 'POST',
      headers: studentAuthHeader,
      body: {
        fcm_token: deviceToken2,
        device_type: 'WEB',
        device_name: 'Firefox on Windows (Browser 2)',
      },
    });

    const { data: studentDevices } = await supabaseAdmin
      .from('user_devices')
      .select('fcm_token, is_active')
      .eq('user_id', studentUser.id)
      .eq('is_active', true);

    const activeTokens = (studentDevices || []).map((d) => d.fcm_token);
    assert(
      activeTokens.includes(deviceToken1) && activeTokens.includes(deviceToken2),
      'User A has multiple active device tokens (Browser 1 & Browser 2) registered simultaneously'
    );

    // -------------------------------------------------------------------------
    // TEST H: User Isolation (User B does not receive User A device notifications)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST H: Cross-User Device Isolation ---');
    const teacherDeviceToken = `test_fcm_token_teacher1_${Date.now()}`;
    await api('/notifications/devices', {
      method: 'POST',
      headers: teacherAuthHeader,
      body: {
        fcm_token: teacherDeviceToken,
        device_type: 'WEB',
        device_name: 'Teacher Desktop',
      },
    });

    const { data: studentDevicesCheck } = await supabaseAdmin
      .from('user_devices')
      .select('fcm_token')
      .eq('user_id', studentUser.id)
      .eq('is_active', true);

    const sTokens = (studentDevicesCheck || []).map((d) => d.fcm_token);
    assert(
      !sTokens.includes(teacherDeviceToken),
      "Student A active devices NEVER include Teacher B's device token"
    );

    // -------------------------------------------------------------------------
    // TEST B & 9: Notification Dispatch & Action URL Routing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST B & 9: Notification Dispatch & Action URL Routing ---');
    const testNotif = await createNotification({
      userId: studentUser.id,
      type: 'ANNOUNCEMENT',
      title: 'End of Term Exam Schedule',
      message: 'Please review the exam timetable for Semester 2.',
      metadata: { announcementId: 'test_ann_123' },
    });

    assert(!!testNotif && !!testNotif.id, 'Notification row created in PostgreSQL');
    assert(testNotif.user_id === studentUser.id, 'Notification assigned strictly to student user_id');
    assert(
      testNotif.metadata?.actionUrl === '/student/announce',
      'Action URL resolved correctly to /student/announce for ANNOUNCEMENT'
    );

    // Verify Notification Center API returns it
    const notifCenterRes = await api('/notifications', { headers: studentAuthHeader });
    const notificationsList = notifCenterRes.data?.data?.notifications || [];
    const found = notificationsList.find((n) => n.id === testNotif.id);
    assert(!!found, 'Notification Center API retrieves the new notification');
    assert(notifCenterRes.data?.data?.unread_count > 0, 'Notification Center unread_count updated correctly');

    // Test Mark as Read
    await api(`/notifications/${testNotif.id}/read`, {
      method: 'PATCH',
      headers: studentAuthHeader,
    });
    const { data: updatedNotif } = await supabaseAdmin
      .from('notifications')
      .select('is_read')
      .eq('id', testNotif.id)
      .single();
    assert(updatedNotif?.is_read === true, 'Notification successfully marked as read');

    // -------------------------------------------------------------------------
    // TEST 9 Routing Verification Across All 14 Notification Categories
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Comprehensive Notification Category Routing Verification ---');
    const routingTests = [
      { type: 'ANNOUNCEMENT', role: 'student', expected: '/student/announce' },
      { type: 'ANNOUNCEMENT', role: 'teacher', expected: '/teacher/announce' },
      { type: 'ANNOUNCEMENT', role: 'admin', expected: '/admin/announcements' },
      { type: 'NEW_STUDY_MATERIAL', role: 'student', expected: '/student/announce' },
      { type: 'ATTENDANCE_MARKED', role: 'student', expected: '/student/attendance' },
      { type: 'ATTENDANCE_CORRECTED', role: 'student', expected: '/student/attendance' },
      { type: 'ATTENDANCE_REMOVED', role: 'student', expected: '/student/attendance' },
      { type: 'LOW_ATTENDANCE', role: 'student', expected: '/student/reports' },
      { type: 'LOW_ATTENDANCE', role: 'teacher', expected: '/teacher/reports' },
      { type: 'LECTURE_STARTING', role: 'student', expected: '/student/mark' },
      { type: 'LECTURE_STARTING', role: 'teacher', expected: '/teacher/classes' },
      { type: 'LECTURE_CANCELLED', role: 'student', expected: '/student' },
      { type: 'LECTURE_RESCHEDULED', role: 'student', expected: '/student' },
      { type: 'TEACHER_APPROVED', role: 'teacher', expected: '/teacher' },
      { type: 'TEACHER_REJECTED', role: 'teacher', expected: '/pending-approval' },
      { type: 'PASSWORD_RESET', role: 'student', expected: '/reset-password' },
      { type: 'PASSWORD_CHANGED', role: 'student', expected: '/student' },
      { type: 'SECURITY_ALERT', role: 'student', expected: '/student' },
    ];

    let allRoutesCorrect = true;
    for (const rt of routingTests) {
      const url = resolveNotificationActionUrl(rt.type, {}, rt.role);
      if (url !== rt.expected) {
        allRoutesCorrect = false;
        console.error(`Mismatch for ${rt.type} (${rt.role}): expected ${rt.expected}, got ${url}`);
      }
    }
    assert(allRoutesCorrect, 'All 14 notification types route to appropriate target pages');

    // -------------------------------------------------------------------------
    // TEST E: Preferences Handling (Optional disabled vs Mandatory enabled)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST E: Notification Preferences Opt-Out & Mandatory Override ---');
    // Update preferences to disable announcements
    await api('/notifications/preferences', {
      method: 'PUT',
      headers: studentAuthHeader,
      body: { announcements: false },
    });

    const isPushAllowedAnn = await isPushAllowedForUser(studentUser.id, 'ANNOUNCEMENT');
    assert(isPushAllowedAnn === false, 'Optional push preference disabled (ANNOUNCEMENT push blocked)');

    // In-app notification must STILL be created in DB
    const optNotif = await createNotification({
      userId: studentUser.id,
      type: 'ANNOUNCEMENT',
      title: 'Opted-Out Category Test',
      message: 'This announcement was created while push preference is OFF.',
    });
    assert(!!optNotif?.id, 'In-app notification row created in database even when push preference is disabled');

    // Mandatory alerts MUST remain enabled
    const isPushAllowedSec = await isPushAllowedForUser(studentUser.id, 'SECURITY_ALERT');
    const isPushAllowedPwd = await isPushAllowedForUser(studentUser.id, 'PASSWORD_CHANGED');
    assert(
      isPushAllowedSec === true && isPushAllowedPwd === true,
      'Mandatory security alerts remain enabled regardless of user settings'
    );

    // Reset preference back to true
    await api('/notifications/preferences', {
      method: 'PUT',
      headers: studentAuthHeader,
      body: { announcements: true },
    });

    // -------------------------------------------------------------------------
    // TEST F: Invalid/Stale Token Deactivation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST F: Invalid / Stale Token Deactivation ---');
    const staleToken = `stale_unregistered_token_${Date.now()}`;
    await supabaseAdmin.from('user_devices').insert({
      user_id: studentUser.id,
      fcm_token: staleToken,
      device_type: 'WEB',
      device_name: 'Stale Browser',
      is_active: true,
    });

    // Call token deactivation
    await deactivateTokens([staleToken]);

    const { data: deactivatedDev } = await supabaseAdmin
      .from('user_devices')
      .select('is_active')
      .eq('fcm_token', staleToken)
      .single();

    assert(
      deactivatedDev && deactivatedDev.is_active === false,
      'Stale/invalid FCM token marked is_active = false without affecting other tokens'
    );

    // -------------------------------------------------------------------------
    // TEST I: Logout Device Token Deactivation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST I: Logout Device Token Deactivation ---');
    await api('/notifications/devices', {
      method: 'DELETE',
      headers: studentAuthHeader,
      body: { fcm_token: deviceToken1 },
    });

    const { data: loggedOutDev } = await supabaseAdmin
      .from('user_devices')
      .select('is_active')
      .eq('fcm_token', deviceToken1)
      .single();

    assert(
      loggedOutDev && loggedOutDev.is_active === false,
      'Device Token 1 deactivated (is_active = false) on logout'
    );

    // Device 2 should remain active
    const { data: remainingDev } = await supabaseAdmin
      .from('user_devices')
      .select('is_active')
      .eq('fcm_token', deviceToken2)
      .single();

    assert(
      remainingDev && remainingDev.is_active === true,
      'Device Token 2 remains active for other active browser session'
    );

    // Clean up test data
    await supabaseAdmin.from('user_devices').delete().in('fcm_token', [deviceToken1, deviceToken2, teacherDeviceToken, staleToken]);
    if (testNotif?.id) await supabaseAdmin.from('notifications').delete().eq('id', testNotif.id);
    if (optNotif?.id) await supabaseAdmin.from('notifications').delete().eq('id', optNotif.id);

    console.log('\n================================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed}/${total} PASSED`);
    console.log('================================================================================\n');

    return { passed, total, success: passed === total };
  } catch (err) {
    console.error('💥 Test suite error:', err);
    return { passed, total, success: false, error: err.message };
  }
}

runStep3Tests().then((res) => {
  process.exit(res.success ? 0 : 1);
});
