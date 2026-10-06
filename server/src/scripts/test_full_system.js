/**
 * SMDL SMART ATTENDANCE & COMMUNICATION SYSTEM
 * COMPREHENSIVE END-TO-END FUNCTIONAL VERIFICATION SUITE
 */

const { supabaseAdmin } = require('../config/db');
const { _tokenStore } = require('../services/passwordResetService');
const { checkAndNotifyLowAttendance } = require('../services/attendanceNotificationService');
const { createNotification } = require('../services/notificationService');

const BASE_URL = 'http://localhost:5000/api';

const results = [];

function recordTest(suite, name, passed, details = '') {
  results.push({ suite, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${suite}] ${icon} - ${name}`);
  if (details) console.log(`       Detail: ${details}`);
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runFullTestSuite() {
  console.log('='.repeat(80));
  console.log('🚀 COMMENCING COMPLETE FUNCTIONAL TEST SUITE FOR SMDL ATTENDANCE SYSTEM');
  console.log('='.repeat(80));

  const timestamp = Date.now();
  const testStudentEmail = `test.student.${timestamp}@smdl.ac.in`;
  const testStudentRoll = `STU-TEST-${timestamp.toString().slice(-5)}`;
  const testTeacherEmail = `test.teacher.${timestamp}@smdl.ac.in`;
  const testTeacherEmpId = `TCH-TEST-${timestamp.toString().slice(-5)}`;
  const testPassword = 'Password@123';
  const testNewPassword = 'NewPassword@456';

  let studentToken = '';
  let studentUser = null;
  let teacherToken = '';
  let teacherUser = null;
  let adminToken = '';
  let adminUser = null;
  let testCourseId = '';
  let testDivisionId = '';
  let testSubjectId = '';
  let testLectureId = '';
  let announcementId = '';

  // --------------------------------------------------------------------------
  // ADMIN AUTHENTICATION
  // --------------------------------------------------------------------------
  console.log('\n--- SETUP: ADMIN AUTHENTICATION ---');
  try {
    const adminRes = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin', password: 'admin@123' },
    });
    if (adminRes.ok && adminRes.data?.data?.token) {
      adminToken = adminRes.data.data.token;
      adminUser = adminRes.data.data.user || adminRes.data.data;
      recordTest('ADMIN', 'Admin Login with shorthand credentials', true, `Admin: ${adminUser.email}`);
    } else {
      const adminRes2 = await api('/auth/login', {
        method: 'POST',
        body: { email: 'admin@smdl.ac.in', password: 'admin@123' },
      });
      adminToken = adminRes2.data?.data?.token || '';
      adminUser = adminRes2.data?.data?.user || adminRes2.data?.data;
      recordTest('ADMIN', 'Admin Login with full email', Boolean(adminToken), `Token obtained: ${Boolean(adminToken)}`);
    }
  } catch (err) {
    recordTest('ADMIN', 'Admin Login', false, err.message);
  }

  const authAdminHeader = { Authorization: `Bearer ${adminToken}` };

  // --------------------------------------------------------------------------
  // ACADEMIC SETUP FOR TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- SETUP: ACADEMIC INFRASTRUCTURE ---');
  try {
    const coursesRes = await api('/academic/courses');
    let courses = coursesRes.data?.data?.courses || [];
    let course = courses.find((c) => c.code === 'B.SC IT' || c.code === 'BSCIT') || courses[0];

    if (!course) {
      const newCourseRes = await api('/academic/courses', {
        method: 'POST',
        headers: authAdminHeader,
        body: { name: 'Bachelor of Science in IT', code: 'BSCIT_TEST', duration_years: 3 },
      });
      course = newCourseRes.data?.data?.course;
    }
    testCourseId = course?.id;

    const divRes = await api(`/academic/divisions?course_id=${testCourseId}`);
    let divs = divRes.data?.data?.divisions || [];
    let division = divs[0];
    if (!division) {
      const newDivRes = await api('/academic/divisions', {
        method: 'POST',
        headers: authAdminHeader,
        body: { course_id: testCourseId, name: 'TY', division_name: 'A' },
      });
      division = newDivRes.data?.data?.division;
    }
    testDivisionId = division?.id;

    const subjRes = await api(`/academic/subjects?division_id=${testDivisionId}`);
    let subjects = subjRes.data?.data?.subjects || [];
    let subject = subjects[0];
    if (!subject) {
      const newSubjRes = await api('/academic/subjects', {
        method: 'POST',
        headers: authAdminHeader,
        body: { name: 'Cloud Computing', code: 'CC_TEST', division_id: testDivisionId },
      });
      subject = newSubjRes.data?.data?.subject;
    }
    testSubjectId = subject?.id;

    recordTest('SETUP', 'Academic structure verified (Course, Division, Subject)', Boolean(testCourseId && testDivisionId && testSubjectId));
  } catch (err) {
    recordTest('SETUP', 'Academic infrastructure setup', false, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 1: STUDENT WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 1: STUDENT WORKFLOWS ---');

  // 1.1 Send OTP
  let studentOtpCode = '';
  try {
    const otpRes = await api('/auth/send-otp', {
      method: 'POST',
      body: { email: testStudentEmail, role: 'student', roll_number: testStudentRoll },
    });
    recordTest('STUDENT', '1.1 Student Registration OTP dispatch', otpRes.ok, `Status: ${otpRes.status}`);

    // Retrieve generated OTP from response in dev mode or DB
    studentOtpCode = otpRes.data?.data?.dev_otp || '';
    if (!studentOtpCode) {
      const { data: vRec } = await supabaseAdmin
        .from('email_verifications')
        .select('otp_code')
        .eq('email', testStudentEmail)
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      studentOtpCode = vRec?.otp_code || '';
    }
    recordTest('STUDENT', '1.2 OTP generation & storage', Boolean(studentOtpCode), `Code: ${studentOtpCode}`);
  } catch (err) {
    recordTest('STUDENT', '1.1 Student OTP dispatch', false, err.message);
  }

  // 1.2 Verify OTP with wrong code (should fail)
  try {
    const wrongRes = await api('/auth/verify-otp', {
      method: 'POST',
      body: { email: testStudentEmail, otp: '000000' },
    });
    recordTest('STUDENT', '1.3 Invalid OTP rejection', wrongRes.status === 400, `Status: ${wrongRes.status}`);
  } catch (err) {
    recordTest('STUDENT', '1.3 Invalid OTP rejection', false, err.message);
  }

  // 1.3 Verify OTP with correct code
  let studentOtpToken = '';
  try {
    const verifyRes = await api('/auth/verify-otp', {
      method: 'POST',
      body: { email: testStudentEmail, otp: studentOtpCode },
    });
    studentOtpToken = verifyRes.data?.data?.otp_token || '';
    recordTest('STUDENT', '1.4 Email verification with correct OTP', verifyRes.ok && Boolean(studentOtpToken), `Token: ${Boolean(studentOtpToken)}`);
  } catch (err) {
    recordTest('STUDENT', '1.4 Email verification', false, err.message);
  }

  // 1.4 Student Registration
  try {
    const regRes = await api('/auth/register/student', {
      method: 'POST',
      body: {
        name: 'Aarav Sharma',
        full_name: 'Aarav Sharma',
        email: testStudentEmail,
        password: testPassword,
        roll_number: testStudentRoll,
        phone: '9876543210',
        course_id: testCourseId,
        division_id: testDivisionId,
        otp_token: studentOtpToken,
      },
    });
    const regOk = regRes.status === 201;
    studentToken = regRes.data?.data?.token || '';
    studentUser = regRes.data?.data?.user || regRes.data?.data;
    recordTest('STUDENT', '1.5 Student Registration execution', regOk && Boolean(studentToken), `Created student ID: ${studentUser?.id}`);
  } catch (err) {
    recordTest('STUDENT', '1.5 Student Registration', false, err.message);
  }

  // 1.5 Student Login (Email & Roll number)
  try {
    const loginEmailRes = await api('/auth/login', {
      method: 'POST',
      body: { email: testStudentEmail, password: testPassword },
    });
    recordTest('STUDENT', '1.6 Student Login via email', loginEmailRes.ok, `Status: ${loginEmailRes.status}`);

    const loginRollRes = await api('/auth/login', {
      method: 'POST',
      body: { email: testStudentRoll, password: testPassword },
    });
    recordTest('STUDENT', '1.7 Student Login via Roll Number identifier', loginRollRes.ok, `Status: ${loginRollRes.status}`);
  } catch (err) {
    recordTest('STUDENT', '1.6/1.7 Student Login', false, err.message);
  }

  // 1.6 Forgot Password & Reset Password Workflow
  try {
    const forgotRes = await api('/auth/forgot-password', {
      method: 'POST',
      body: { email: testStudentEmail },
    });
    recordTest('STUDENT', '1.8 Forgot Password request endpoint', forgotRes.ok, `Status: ${forgotRes.status}`);

    let rawResetToken = forgotRes.data?.dev_token || '';
    if (!rawResetToken) {
      for (const [hash, rec] of _tokenStore.entries()) {
        if (rec.email === testStudentEmail && rec.rawToken) {
          rawResetToken = rec.rawToken;
          break;
        }
      }
    }

    recordTest('STUDENT', '1.9 Password reset token generation', Boolean(rawResetToken), `Token generated: ${Boolean(rawResetToken)}`);

    const valRes = await api(`/auth/reset-password/validate?token=${rawResetToken}`);
    const isValidToken = valRes.ok && Boolean(valRes.data?.valid || valRes.data?.data?.valid);
    recordTest('STUDENT', '1.10 Validate Reset Password token endpoint', isValidToken, `Valid: ${isValidToken}`);

    const resetRes = await api('/auth/reset-password', {
      method: 'POST',
      body: { token: rawResetToken, password: testNewPassword, confirm_password: testNewPassword },
    });
    recordTest('STUDENT', '1.11 Execute Password Reset', resetRes.ok, `Status: ${resetRes.status}`);

    const newLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: testStudentEmail, password: testNewPassword },
    });
    if (newLoginRes.ok && newLoginRes.data?.data?.token) {
      studentToken = newLoginRes.data.data.token;
    }
    recordTest('STUDENT', '1.12 Login with updated password', newLoginRes.ok, `Status: ${newLoginRes.status}`);
  } catch (err) {
    recordTest('STUDENT', '1.8-1.12 Forgot/Reset Password', false, err.message);
  }

  const authStudentHeader = { Authorization: `Bearer ${studentToken}` };

  // 1.7 Student Dashboard & Today Classes
  try {
    const todayRes = await api('/student/today-classes', { headers: authStudentHeader });
    recordTest('STUDENT', '1.13 Student Dashboard today classes query', todayRes.ok, `Status: ${todayRes.status}`);
  } catch (err) {
    recordTest('STUDENT', '1.13 Student Dashboard today classes', false, err.message);
  }

  // 1.8 Create an active lecture session for attendance tests
  try {
    const lecRes = await api('/lectures', {
      method: 'POST',
      headers: authAdminHeader,
      body: {
        subject_id: testSubjectId,
        division_id: testDivisionId,
        topic: 'Unit 3: Cloud Architecture & Scaling',
      },
    });
    testLectureId = lecRes.data?.data?.lecture?.id || '';
    recordTest('LECTURES', 'Scheduled active lecture session for testing', Boolean(testLectureId), `Lecture ID: ${testLectureId}`);
  } catch (err) {
    recordTest('LECTURES', 'Lecture creation', false, err.message);
  }

  // 1.9 Attendance Location Verification (Outside Geofence rejection)
  try {
    const dummySelfie = 'data:image/jpeg;base64,' + Buffer.from('mock_selfie_image').toString('base64');
    const outsideRes = await api('/attendance/mark', {
      method: 'POST',
      headers: authStudentHeader,
      body: {
        lecture_id: testLectureId,
        latitude: 28.6139,
        longitude: 77.2090,
        selfie: dummySelfie,
      },
    });
    recordTest('STUDENT', '1.14 Location Verification (Rejects coordinates outside 500m geofence)', outsideRes.status === 400, `Response: ${outsideRes.data?.message}`);
  } catch (err) {
    recordTest('STUDENT', '1.14 Location Verification', false, err.message);
  }

  // 1.10 Attendance Selfie Verification (Selfie missing rejection)
  try {
    const noSelfieRes = await api('/attendance/mark', {
      method: 'POST',
      headers: authStudentHeader,
      body: {
        lecture_id: testLectureId,
        latitude: 19.02479,
        longitude: 73.10159,
        selfie: '',
      },
    });
    recordTest('STUDENT', '1.15 Selfie Verification (Rejects when selfie is missing)', noSelfieRes.status === 400, `Response: ${noSelfieRes.data?.message}`);
  } catch (err) {
    recordTest('STUDENT', '1.15 Selfie Verification', false, err.message);
  }

  // 1.11 Valid Attendance Marking
  try {
    const validSelfie = 'data:image/jpeg;base64,' + Buffer.from('student_live_selfie_verification').toString('base64');
    const markRes = await api('/attendance/mark', {
      method: 'POST',
      headers: authStudentHeader,
      body: {
        lecture_id: testLectureId,
        latitude: 19.02479,
        longitude: 73.10159,
        selfie: validSelfie,
      },
    });
    recordTest('STUDENT', '1.16 Successful Attendance Marking with GPS + Selfie', markRes.status === 201, `Status: ${markRes.status}`);

    const dupRes = await api('/attendance/mark', {
      method: 'POST',
      headers: authStudentHeader,
      body: {
        lecture_id: testLectureId,
        latitude: 19.02479,
        longitude: 73.10159,
        selfie: validSelfie,
      },
    });
    recordTest('STUDENT', '1.17 Anti-Proxy Duplicate attendance protection', dupRes.status === 400, `Message: ${dupRes.data?.message}`);
  } catch (err) {
    recordTest('STUDENT', '1.16/1.17 Attendance Marking', false, err.message);
  }

  // 1.12 Attendance History & Subject-wise Metrics
  try {
    const statsRes = await api('/attendance/my-stats', { headers: authStudentHeader });
    const hasData = statsRes.ok && statsRes.data?.data?.stats?.total_lectures >= 1;
    recordTest('STUDENT', '1.18 Attendance History & Subject-wise percentages', hasData, `Attended: ${statsRes.data?.data?.stats?.attended}`);
  } catch (err) {
    recordTest('STUDENT', '1.18 Attendance History', false, err.message);
  }

  // 1.13 Low Attendance Notification Trigger
  try {
    const { data: studentRecord } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', studentUser.id)
      .single();

    if (studentRecord) {
      await checkAndNotifyLowAttendance(studentRecord.id, testSubjectId);
    }
    recordTest('STUDENT', '1.19 Low attendance evaluator execution', true, 'Evaluated successfully');
  } catch (err) {
    recordTest('STUDENT', '1.19 Low attendance evaluator', false, err.message);
  }

  // 1.14 Notification Center
  try {
    const notifRes = await api('/notifications', { headers: authStudentHeader });
    const notifs = notifRes.data?.data?.notifications || [];
    recordTest('STUDENT', '1.20 Notification Center feed', notifRes.ok, `Count: ${notifs.length}`);

    if (notifs.length > 0) {
      const readOneRes = await api(`/notifications/${notifs[0].id}/read`, {
        method: 'PATCH',
        headers: authStudentHeader,
      });
      recordTest('STUDENT', '1.21 Mark single notification as read', readOneRes.ok, `Status: ${readOneRes.status}`);
    }

    const readAllRes = await api('/notifications/mark-all-read', {
      method: 'POST',
      headers: authStudentHeader,
    });
    recordTest('STUDENT', '1.22 Mark all notifications as read', readAllRes.ok, `Status: ${readAllRes.status}`);
  } catch (err) {
    recordTest('STUDENT', '1.20-1.22 Notification Center', false, err.message);
  }

  // 1.15 Notification Preferences
  try {
    const getPrefRes = await api('/notifications/preferences', { headers: authStudentHeader });
    recordTest('STUDENT', '1.23 Get Notification Preferences', getPrefRes.ok, `Prefs loaded: ${Boolean(getPrefRes.data?.data?.preferences)}`);

    const updatePrefRes = await api('/notifications/preferences', {
      method: 'PUT',
      headers: authStudentHeader,
      body: { lecture_reminders: false, announcements: true },
    });
    recordTest('STUDENT', '1.24 Update Notification Preferences', updatePrefRes.ok && updatePrefRes.data?.data?.preferences?.lecture_reminders === false, 'lecture_reminders set to false');
  } catch (err) {
    recordTest('STUDENT', '1.23/1.24 Notification Preferences', false, err.message);
  }

  // 1.16 Student Device Token & Logout
  try {
    const devRes = await api('/notifications/devices', {
      method: 'POST',
      headers: authStudentHeader,
      body: { fcm_token: `test_token_${timestamp}`, device_type: 'WEB', device_name: 'Chrome Test' },
    });
    recordTest('STUDENT', '1.25 Register device token for push', devRes.status === 201, `Status: ${devRes.status}`);

    const unregRes = await api('/notifications/devices', {
      method: 'DELETE',
      headers: authStudentHeader,
      body: { fcm_token: `test_token_${timestamp}` },
    });
    recordTest('STUDENT', '1.26 Unregister device token on logout', unregRes.ok, `Status: ${unregRes.status}`);
  } catch (err) {
    recordTest('STUDENT', '1.25/1.26 Device token management', false, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 2: TEACHER WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: TEACHER WORKFLOWS ---');

  // 2.1 Teacher Registration & OTP
  let teacherOtpCode = '';
  try {
    const tOtpRes = await api('/auth/send-otp', {
      method: 'POST',
      body: { email: testTeacherEmail, role: 'teacher', employee_id: testTeacherEmpId },
    });

    teacherOtpCode = tOtpRes.data?.data?.dev_otp || '';
    if (!teacherOtpCode) {
      const { data: tvRec } = await supabaseAdmin
        .from('email_verifications')
        .select('otp_code')
        .eq('email', testTeacherEmail)
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      teacherOtpCode = tvRec?.otp_code || '';
    }
    recordTest('TEACHER', '2.1 Teacher OTP dispatch & verification code creation', Boolean(teacherOtpCode), `Code: ${teacherOtpCode}`);

    const tVerifyRes = await api('/auth/verify-otp', {
      method: 'POST',
      body: { email: testTeacherEmail, otp: teacherOtpCode },
    });
    const tOtpToken = tVerifyRes.data?.data?.otp_token;

    const tRegRes = await api('/auth/register/teacher', {
      method: 'POST',
      body: {
        name: 'Prof. Rajesh Kulkarni',
        full_name: 'Prof. Rajesh Kulkarni',
        email: testTeacherEmail,
        password: testPassword,
        employee_id: testTeacherEmpId,
        department: 'Information Technology',
        designation: 'Assistant Professor',
        phone: '9820098200',
        otp_token: tOtpToken,
      },
    });

    const isPending = tRegRes.data?.data?.account_status === 'PENDING' || tRegRes.data?.data?.user?.account_status === 'PENDING';
    teacherToken = tRegRes.data?.data?.token || '';
    teacherUser = tRegRes.data?.data?.user || tRegRes.data?.data;
    recordTest('TEACHER', '2.2 Teacher Registration enters PENDING approval state', tRegRes.status === 201 && isPending, `Status: PENDING`);
  } catch (err) {
    recordTest('TEACHER', '2.1/2.2 Teacher Registration', false, err.message);
  }

  const authTeacherHeader = { Authorization: `Bearer ${teacherToken}` };

  // 2.2 Pending State Access Restrictions
  try {
    const pendingActionRes = await api('/lectures', {
      method: 'POST',
      headers: authTeacherHeader,
      body: { subject_id: testSubjectId, division_id: testDivisionId },
    });
    recordTest('TEACHER', '2.3 Pending Teacher mutation blocked (403 Forbidden)', pendingActionRes.status === 403, `Status: ${pendingActionRes.status}`);
  } catch (err) {
    recordTest('TEACHER', '2.3 Pending Teacher mutation blocked', false, err.message);
  }

  // 2.3 Admin Rejection Flow
  try {
    const rejectRes = await api(`/admin/teachers/${teacherUser.id}/reject`, {
      method: 'POST',
      headers: authAdminHeader,
      body: { reason: 'Incomplete document verification for testing' },
    });
    recordTest('TEACHER', '2.4 Admin rejects teacher with mandatory reason', rejectRes.ok && rejectRes.data?.data?.account_status === 'REJECTED', `Status: ${rejectRes.data?.data?.account_status}`);

    const rejectedLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: testTeacherEmail, password: testPassword },
    });
    recordTest('TEACHER', '2.5 Rejected Teacher login restricted (401 Unauthorized)', rejectedLoginRes.status === 401, `Message: ${rejectedLoginRes.data?.message}`);
  } catch (err) {
    recordTest('TEACHER', '2.4/2.5 Teacher rejection flow', false, err.message);
  }

  // 2.4 Admin Approval Flow
  try {
    const approveRes = await api(`/admin/teachers/${teacherUser.id}/approve`, {
      method: 'POST',
      headers: authAdminHeader,
      body: { reason: 'Credentials verified and approved' },
    });
    recordTest('TEACHER', '2.6 Admin approves teacher account', approveRes.ok && approveRes.data?.data?.account_status === 'ACTIVE', `Status: ACTIVE`);

    const approvedLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: testTeacherEmail, password: testPassword },
    });
    teacherToken = approvedLoginRes.data?.data?.token || teacherToken;
    recordTest('TEACHER', '2.7 Approved Teacher login succeeds with ACTIVE status', approvedLoginRes.ok, `Status: ${approvedLoginRes.status}`);
  } catch (err) {
    recordTest('TEACHER', '2.6/2.7 Teacher approval flow', false, err.message);
  }

  const activeTeacherHeader = { Authorization: `Bearer ${teacherToken}` };

  // 2.5 Teacher Dashboard & Assigned Classes
  try {
    const schedRes = await api('/lectures/today', { headers: activeTeacherHeader });
    recordTest('TEACHER', '2.8 Teacher Dashboard daily schedule & timetable query', schedRes.ok, `Status: ${schedRes.status}`);

    const { data: teacherProfile } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', teacherUser.id)
      .single();

    if (teacherProfile) {
      await supabaseAdmin
        .from('teacher_subjects')
        .insert({ teacher_id: teacherProfile.id, subject_id: testSubjectId });
    }

    const meRes = await api('/auth/me', { headers: activeTeacherHeader });
    recordTest('TEACHER', '2.9 Teacher assigned subjects profile query', meRes.ok, `Profile: ${meRes.data?.data?.name}`);
  } catch (err) {
    recordTest('TEACHER', '2.8/2.9 Teacher dashboard', false, err.message);
  }

  // 2.6 View Attendance Roster for Lecture
  try {
    const rosterRes = await api(`/attendance/lecture/${testLectureId}`, { headers: activeTeacherHeader });
    const roster = rosterRes.data?.data?.roster || [];
    recordTest('TEACHER', '2.10 Teacher views live lecture attendance roster', rosterRes.ok, `Roster count: ${roster.length}`);
  } catch (err) {
    recordTest('TEACHER', '2.10 Teacher views live roster', false, err.message);
  }

  // 2.7 Manual Attendance Check-in & Override
  try {
    const { data: studentRecord } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', studentUser.id)
      .single();

    const removeRes = await api('/attendance/override', {
      method: 'POST',
      headers: activeTeacherHeader,
      body: {
        lecture_id: testLectureId,
        student_pk: studentRecord.id,
        student_id: studentRecord.id,
        status: 'ABSENT',
        reason: 'Student left classroom early without permission',
      },
    });
    recordTest('TEACHER', '2.11 Teacher overrides attendance: PRESENT -> ABSENT (Attendance Removed)', removeRes.ok, `Status: ${removeRes.data?.data?.attendance?.status}`);

    const correctRes = await api('/attendance/override', {
      method: 'POST',
      headers: activeTeacherHeader,
      body: {
        lecture_id: testLectureId,
        student_pk: studentRecord.id,
        student_id: studentRecord.id,
        status: 'PRESENT',
        reason: 'Physical presence verified by professor (No smartphone)',
      },
    });
    recordTest('TEACHER', '2.12 Teacher marks manual attendance / correction with audit reason', correctRes.ok, `Status: ${correctRes.data?.data?.attendance?.status}`);

    const auditRes = await api('/admin/attendance/audit-logs', { headers: authAdminHeader });
    const logs = auditRes.data?.data?.logs || [];
    const hasLog = logs.some((l) => l.reason?.includes('Physical presence verified'));
    recordTest('TEACHER', '2.13 Attendance Audit Log created and verified for dispute resolution', hasLog, `Logs inspected: ${logs.length}`);
  } catch (err) {
    recordTest('TEACHER', '2.11-2.13 Attendance override & audit', false, err.message);
  }

  // 2.8 Teacher Announcements & Document Attachments
  try {
    const mockPdfBase64 = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 Mock Lecture Notes').toString('base64');
    const annRes = await api('/announcements', {
      method: 'POST',
      headers: activeTeacherHeader,
      body: {
        title: 'Unit 3 Study Material & Reference Notes',
        content: 'Please find attached lecture notes for Cloud Architecture.',
        target_type: 'ALL',
        category: 'STUDY_MATERIAL',
        attachment: {
          name: 'cloud_architecture_notes.pdf',
          type: 'DOCUMENT',
          size: 1048576,
          data: mockPdfBase64,
        },
      },
    });
    announcementId = annRes.data?.data?.announcement?.id;
    recordTest('TEACHER', '2.14 Teacher creates Announcement with PDF attachment & study material', annRes.status === 201 && Boolean(announcementId), `Announcement ID: ${announcementId}`);

    const annListRes = await api('/announcements', { headers: authStudentHeader });
    const list = annListRes.data?.data?.announcements || [];
    const createdAnn = list.find((a) => a.id === announcementId);
    const hasAtt = createdAnn && createdAnn.attachments && createdAnn.attachments.length > 0;
    recordTest('TEACHER', '2.15 Student feed receives announcement with attachment file metadata', Boolean(hasAtt), `Attachments: ${createdAnn?.attachments?.length}`);
  } catch (err) {
    recordTest('TEACHER', '2.14/2.15 Teacher announcements', false, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: ADMIN WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: ADMIN WORKFLOWS ---');

  // 3.1 Student Management
  try {
    const stListRes = await api('/admin/students', { headers: authAdminHeader });
    recordTest('ADMIN', '3.1 List students roster', stListRes.ok, `Count: ${stListRes.data?.count}`);

    const toggleRes = await api(`/admin/students/${studentUser.id}/status`, {
      method: 'PATCH',
      headers: authAdminHeader,
      body: { status: 'ACTIVE' },
    });
    recordTest('ADMIN', '3.2 Update student account status', toggleRes.ok, `Status: ACTIVE`);

    const transferRes = await api(`/admin/students/${studentUser.id}/transfer`, {
      method: 'POST',
      headers: authAdminHeader,
      body: { new_division_id: testDivisionId, division_id: testDivisionId },
    });
    recordTest('ADMIN', '3.3 Transfer student division', transferRes.ok, `Division: ${testDivisionId}`);
  } catch (err) {
    recordTest('ADMIN', '3.1-3.3 Student management', false, err.message);
  }

  // 3.2 Teacher Management (list, suspend, disable)
  try {
    const tchListRes = await api('/admin/teachers', { headers: authAdminHeader });
    recordTest('ADMIN', '3.4 List teachers directory with status filters', tchListRes.ok, `Teachers count: ${tchListRes.data?.count}`);

    const suspRes = await api(`/admin/teachers/${teacherUser.id}/suspend`, {
      method: 'POST',
      headers: authAdminHeader,
      body: { reason: 'Temporary administrative audit' },
    });
    recordTest('ADMIN', '3.5 Suspend teacher account with session invalidation', suspRes.ok && suspRes.data?.data?.account_status === 'SUSPENDED', `Status: SUSPENDED`);

    const suspLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { email: testTeacherEmail, password: testPassword },
    });
    recordTest('ADMIN', '3.6 Suspended teacher login rejected (401)', suspLoginRes.status === 401, `Status: ${suspLoginRes.status}`);

    const disRes = await api(`/admin/teachers/${teacherUser.id}/disable`, {
      method: 'POST',
      headers: authAdminHeader,
      body: { reason: 'Permanent contract termination' },
    });
    recordTest('ADMIN', '3.7 Disable teacher account permanently', disRes.ok && disRes.data?.data?.account_status === 'DISABLED', `Status: DISABLED`);

    await supabaseAdmin.from('users').update({ status: 'ACTIVE' }).eq('id', teacherUser.id);
  } catch (err) {
    recordTest('ADMIN', '3.4-3.7 Teacher management', false, err.message);
  }

  // 3.3 Course, Division & Subject Management (CRUD)
  try {
    const newSubjRes = await api('/academic/subjects', {
      method: 'POST',
      headers: authAdminHeader,
      body: { name: 'Automated Testing', code: `AUT_${timestamp.toString().slice(-4)}`, division_id: testDivisionId },
    });
    const createdSubj = newSubjRes.data?.data?.subject;
    recordTest('ADMIN', '3.8 Admin creates academic Subject', newSubjRes.status === 201 && Boolean(createdSubj?.id), `Code: ${createdSubj?.code}`);

    const batchSubjRes = await api('/academic/subjects/batch', {
      method: 'POST',
      headers: authAdminHeader,
      body: {
        division_ids: [testDivisionId],
        subjects: [
          { name: 'Machine Learning', code: `ML_${timestamp.toString().slice(-4)}` },
          { name: 'DevOps & CI/CD', code: `DEV_${timestamp.toString().slice(-4)}` },
        ],
      },
    });
    recordTest('ADMIN', '3.9 Admin batch creates multiple subjects', batchSubjRes.status === 201, `Status: ${batchSubjRes.status}`);

    if (createdSubj?.id) {
      const delSubjRes = await api(`/academic/subjects/${createdSubj.id}`, {
        method: 'DELETE',
        headers: authAdminHeader,
      });
      recordTest('ADMIN', '3.10 Admin deletes Subject', delSubjRes.ok, `Status: ${delSubjRes.status}`);
    }
  } catch (err) {
    recordTest('ADMIN', '3.8-3.10 Subject management', false, err.message);
  }

  // 3.4 Timetable Management
  try {
    const slotRes = await api('/academic/timetable', {
      method: 'POST',
      headers: authAdminHeader,
      body: {
        division_id: testDivisionId,
        subject_id: testSubjectId,
        day_of_week: 'Tuesday',
        start_time: '11:00',
        end_time: '12:00',
        room_number: 'Lab 402',
      },
    });
    const slotId = slotRes.data?.data?.slot?.id;
    recordTest('ADMIN', '3.11 Admin creates Timetable slot', slotRes.status === 201 && Boolean(slotId), `Slot: ${slotId}`);

    if (slotId) {
      const delSlotRes = await api(`/academic/timetable/${slotId}`, {
        method: 'DELETE',
        headers: authAdminHeader,
      });
      recordTest('ADMIN', '3.12 Admin deletes Timetable slot', delSlotRes.ok, `Status: ${delSlotRes.status}`);
    }
  } catch (err) {
    recordTest('ADMIN', '3.11/3.12 Timetable management', false, err.message);
  }

  // 3.5 Lecture Management
  try {
    const testLecRes = await api('/lectures', {
      method: 'POST',
      headers: authAdminHeader,
      body: { subject_id: testSubjectId, division_id: testDivisionId, topic: 'Lecture Lifecycle Test' },
    });
    const lifeLecId = testLecRes.data?.data?.lecture?.id;

    const reschedRes = await api(`/lectures/${lifeLecId}/status`, {
      method: 'PATCH',
      headers: authAdminHeader,
      body: { status: 'RESCHEDULED', new_time: '15:00', reason: 'Faculty meeting conflict' },
    });
    recordTest('ADMIN', '3.13 Lecture Rescheduling with notification trigger', reschedRes.ok, `Status: RESCHEDULED`);

    const cancelRes = await api(`/lectures/${lifeLecId}/status`, {
      method: 'PATCH',
      headers: authAdminHeader,
      body: { status: 'CANCELLED', reason: 'College Symposium Day' },
    });
    recordTest('ADMIN', '3.14 Lecture Cancellation with notification trigger', cancelRes.ok, `Status: CANCELLED`);

    const delLecRes = await api(`/lectures/${lifeLecId}`, {
      method: 'DELETE',
      headers: authAdminHeader,
    });
    recordTest('ADMIN', '3.15 Admin deletes lecture session', delLecRes.ok, `Status: ${delLecRes.status}`);
  } catch (err) {
    recordTest('ADMIN', '3.13-3.15 Lecture lifecycle management', false, err.message);
  }

  // 3.6 Attendance Management
  try {
    const summaryRes = await api('/admin/attendance/live-summary', { headers: authAdminHeader });
    recordTest('ADMIN', '3.16 Live Attendance Summary metric query', summaryRes.ok, `Today lectures: ${summaryRes.data?.data?.today_lectures_count}`);

    const repRes = await api('/attendance/reports/overview?days=30', { headers: authAdminHeader });
    recordTest('ADMIN', '3.17 College-wide Attendance Reports & Defaulter overview', repRes.ok, `Status: ${repRes.status}`);
  } catch (err) {
    recordTest('ADMIN', '3.16/3.17 Attendance reports', false, err.message);
  }

  // 3.7 System Configuration (GET & PUT)
  try {
    const cfgGetRes = await api('/admin/config', { headers: authAdminHeader });
    recordTest('ADMIN', '3.18 Get System Configuration settings', cfgGetRes.ok, `Configs loaded: ${cfgGetRes.data?.data?.configs?.length}`);

    const cfgPutRes = await api('/admin/config', {
      method: 'PUT',
      headers: authAdminHeader,
      body: { geofence_radius_meters: '500', low_attendance_threshold: '75' },
    });
    recordTest('ADMIN', '3.19 Update System Configuration (geofence & thresholds)', cfgPutRes.ok, `Status: ${cfgPutRes.status}`);
  } catch (err) {
    recordTest('ADMIN', '3.18/3.19 System configuration', false, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 4: NOTIFICATIONS VERIFICATION (ALL 14 REQUIRED TYPES)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: NOTIFICATIONS VERIFICATION (ALL 14 TYPES) ---');

  const requiredNotificationTypes = [
    { type: 'ANNOUNCEMENT', desc: 'Announcement broadcast notification' },
    { type: 'ATTENDANCE_MARKED', desc: 'Attendance marked notification' },
    { type: 'ATTENDANCE_CORRECTED', desc: 'Attendance corrected notification' },
    { type: 'ATTENDANCE_REMOVED', desc: 'Attendance removed notification' },
    { type: 'LOW_ATTENDANCE', desc: 'Low attendance warning notification' },
    { type: 'PASSWORD_CHANGED', desc: 'Password changed security notification' },
    { type: 'PASSWORD_RESET', desc: 'Password reset request notification' },
    { type: 'TEACHER_APPROVED', desc: 'Teacher account approved notification' },
    { type: 'TEACHER_REJECTED', desc: 'Teacher account rejected notification' },
    { type: 'LECTURE_STARTING', desc: 'Lecture starting reminder notification' },
    { type: 'LECTURE_CANCELLED', desc: 'Lecture cancelled notification' },
    { type: 'LECTURE_RESCHEDULED', desc: 'Lecture rescheduled notification' },
    { type: 'NEW_STUDY_MATERIAL', desc: 'Study material uploaded notification' },
    { type: 'SECURITY_ALERT', desc: 'Security alert notification' },
  ];

  for (const item of requiredNotificationTypes) {
    try {
      await createNotification({
        userId: studentUser.id,
        type: item.type,
        title: item.desc,
        message: `Functional verification test message for ${item.type}`,
        metadata: { verification_test: true },
      });
      recordTest('NOTIFICATIONS', `4. Dispatch & Persist ${item.type}`, true, item.desc);
    } catch (err) {
      recordTest('NOTIFICATIONS', `4. Dispatch ${item.type}`, false, err.message);
    }
  }

  try {
    const studentNotifsRes = await api('/notifications?limit=100', { headers: authStudentHeader });
    const fetchedNotifs = studentNotifsRes.data?.data?.notifications || [];
    const receivedTypes = new Set(fetchedNotifs.map((n) => n.type));

    for (const reqItem of requiredNotificationTypes) {
      const isPresent = receivedTypes.has(reqItem.type) || (reqItem.type === 'NEW_STUDY_MATERIAL' && receivedTypes.has('STUDY_MATERIAL'));
      recordTest('NOTIFICATIONS_VERIFY', `API verified: ${reqItem.type}`, isPresent, `Received: ${isPresent}`);
    }
  } catch (err) {
    recordTest('NOTIFICATIONS_VERIFY', 'Verification of notification types', false, err.message);
  }

  // --------------------------------------------------------------------------
  // CLEANUP TEST USERS
  // --------------------------------------------------------------------------
  console.log('\n--- CLEANUP ---');
  try {
    if (announcementId) {
      await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
    }
    if (testLectureId) {
      await supabaseAdmin.from('attendance').delete().eq('lecture_id', testLectureId);
      await supabaseAdmin.from('lectures').delete().eq('id', testLectureId);
    }
    if (studentUser?.id) {
      await supabaseAdmin.from('notifications').delete().eq('user_id', studentUser.id);
      await supabaseAdmin.from('students').delete().eq('user_id', studentUser.id);
      await supabaseAdmin.from('users').delete().eq('id', studentUser.id);
    }
    if (teacherUser?.id) {
      await supabaseAdmin.from('notifications').delete().eq('user_id', teacherUser.id);
      await supabaseAdmin.from('teachers').delete().eq('user_id', teacherUser.id);
      await supabaseAdmin.from('users').delete().eq('id', teacherUser.id);
    }
    recordTest('CLEANUP', 'Temporary test data and accounts cleaned cleanly', true);
  } catch (e) {
    console.warn('Cleanup notice:', e.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`📊 FINAL TEST RUN RESULTS: ${passedCount} PASSED | ${failedCount} FAILED out of ${results.length} total tests`);
  console.log('='.repeat(80));

  return { passedCount, failedCount, total: results.length, results };
}

if (require.main === module) {
  runFullTestSuite()
    .then(({ failedCount }) => {
      process.exit(failedCount === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}

module.exports = { runFullTestSuite };
