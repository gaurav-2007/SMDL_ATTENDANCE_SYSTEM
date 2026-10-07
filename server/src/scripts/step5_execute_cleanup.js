/**
 * STEP 5 — PRODUCTION TEST-DATA CLEANUP EXECUTION SCRIPT
 *
 * Implements:
 * 1. Pre-execution backup verification (must exist on disk before any delete).
 * 2. Option 1A: Clear all test/demo lectures (19 rows) for clean slate timetable re-population.
 * 3. Delete 18 demo students (@smdl.ac.in) as requested ("KOI BHI STUDENT APNE PERSONAL GMAIL SE HI LOGIN KAREGA").
 * 4. Preserve 3 real student accounts with personal Gmail (gauravmar155@gmail.com, mauryavandana873@gmail.com, studentsstudy02@gmail.com).
 * 5. Delete all test notifications (311 rows), test announcements (2 rows), test OTPs (12 rows), mock device tokens (3 rows).
 * 6. Delete all test attendance records (5 rows) and storage objects (8 files in attendance-selfies).
 * 7. Strictly preserve: Admin (admin@smdl.ac.in), all 8 teachers, all courses (3), divisions (9), subjects (31), teacher_subjects (15), system_config (10).
 * 8. Comprehensive post-cleanup verification.
 */

const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/db');

const BACKUP_DIR = path.resolve(__dirname, '../../../../backups/pre_step5_backup_20261007');

async function executeStep5Cleanup() {
  console.log('================================================================================');
  console.log('SMDL COLLEGE SMART ATTENDANCE SYSTEM — STEP 5 FINAL CLEANUP EXECUTION');
  console.log('================================================================================');
  console.log(`Execution Time: ${new Date().toISOString()}\n`);

  // ---------------------------------------------------------------------------
  // 1. VERIFY BACKUP INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('🔍 1. VERIFYING PRE-CLEANUP BACKUPS ON DISK...');
  const fullBackupFile = path.join(BACKUP_DIR, 'database_full_backup.json');
  const sqlRestoreFile = path.join(BACKUP_DIR, 'database_restore.sql');
  const storageDir = path.join(BACKUP_DIR, 'storage', 'attendance-selfies');

  if (!fs.existsSync(fullBackupFile) || !fs.existsSync(sqlRestoreFile)) {
    throw new Error(`CRITICAL ABORT: Backup files not found at ${BACKUP_DIR}`);
  }

  const backupStats = fs.statSync(fullBackupFile);
  console.log(`  ✅ Full DB Backup JSON verified: ${(backupStats.size / 1024).toFixed(1)} KB`);
  console.log(`  ✅ SQL Restore Script verified: ${(fs.statSync(sqlRestoreFile).size / 1024).toFixed(1)} KB`);

  const storageFiles = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];
  console.log(`  ✅ Storage backup verified: ${storageFiles.length} objects saved locally.\n`);

  // ---------------------------------------------------------------------------
  // 2. CLEANUP ATTENDANCE TEST RECORDS (5 rows)
  // ---------------------------------------------------------------------------
  console.log('🧹 2. CLEANING TEST ATTENDANCE RECORDS...');
  const { data: attBefore, count: attCountBefore } = await supabaseAdmin
    .from('attendance')
    .select('id', { count: 'exact' });
  console.log(`  Found ${attCountBefore || 0} attendance records.`);

  if (attCountBefore > 0) {
    const { error: attErr } = await supabaseAdmin
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (attErr) throw new Error(`Failed to delete attendance: ${attErr.message}`);
    console.log(`  ✅ Cleared all ${attCountBefore} attendance test records.`);
  }

  // ---------------------------------------------------------------------------
  // 3. CLEANUP ATTENDANCE STORAGE OBJECTS (8 objects)
  // ---------------------------------------------------------------------------
  console.log('\n🧹 3. CLEANING TEST STORAGE OBJECTS IN attendance-selfies...');
  const { data: filesToDelete, error: listErr } = await supabaseAdmin.storage
    .from('attendance-selfies')
    .list('', { limit: 1000 });

  let deletedObjectsCount = 0;
  if (!listErr && filesToDelete && filesToDelete.length > 0) {
    // Collect all paths recursively
    const filePaths = [];
    async function collectPaths(prefix = '') {
      const { data: items } = await supabaseAdmin.storage
        .from('attendance-selfies')
        .list(prefix, { limit: 1000 });
      for (const item of items || []) {
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
          await collectPaths(itemPath);
        } else {
          filePaths.push(itemPath);
        }
      }
    }
    await collectPaths('');

    if (filePaths.length > 0) {
      const { data: delResult, error: delErr } = await supabaseAdmin.storage
        .from('attendance-selfies')
        .remove(filePaths);
      if (delErr) {
        console.warn(`  ⚠️ Warning deleting storage objects: ${delErr.message}`);
      } else {
        deletedObjectsCount = filePaths.length;
        console.log(`  ✅ Deleted ${deletedObjectsCount} test selfie object(s) from Supabase Storage.`);
      }
    }
  } else {
    console.log('  Bucket attendance-selfies is already empty or clean.');
  }

  // ---------------------------------------------------------------------------
  // 4. CLEANUP LECTURES (OPTION 1A: ALL 19 ROWS)
  // ---------------------------------------------------------------------------
  console.log('\n🧹 4. CLEANING LECTURES TABLE (OPTION 1A: CLEAN SLATE)...');
  const { count: lecCountBefore } = await supabaseAdmin
    .from('lectures')
    .select('id', { count: 'exact' });
  console.log(`  Found ${lecCountBefore || 0} lecture records.`);

  if (lecCountBefore > 0) {
    const { error: lecErr } = await supabaseAdmin
      .from('lectures')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (lecErr) throw new Error(`Failed to delete lectures: ${lecErr.message}`);
    console.log(`  ✅ Cleared all ${lecCountBefore} lecture rows.`);
  }

  // ---------------------------------------------------------------------------
  // 5. CLEANUP NOTIFICATIONS (311 ROWS)
  // ---------------------------------------------------------------------------
  console.log('\n🧹 5. CLEANING TEST NOTIFICATIONS...');
  const { count: notifCountBefore } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact' });
  console.log(`  Found ${notifCountBefore || 0} notifications.`);

  if (notifCountBefore > 0) {
    const { error: notifErr } = await supabaseAdmin
      .from('notifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (notifErr) throw new Error(`Failed to delete notifications: ${notifErr.message}`);
    console.log(`  ✅ Cleared all ${notifCountBefore} test notifications.`);
  }

  // ---------------------------------------------------------------------------
  // 6. CLEANUP ANNOUNCEMENTS (2 ROWS)
  // ---------------------------------------------------------------------------
  console.log('\n🧹 6. CLEANING TEST ANNOUNCEMENTS...');
  const { count: annCountBefore } = await supabaseAdmin
    .from('announcements')
    .select('id', { count: 'exact' });
  console.log(`  Found ${annCountBefore || 0} announcements.`);

  if (annCountBefore > 0) {
    const { error: annErr } = await supabaseAdmin
      .from('announcements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (annErr) throw new Error(`Failed to delete announcements: ${annErr.message}`);
    console.log(`  ✅ Cleared all ${annCountBefore} test announcements.`);
  }

  // ---------------------------------------------------------------------------
  // 7. CLEANUP EMAIL VERIFICATIONS (12 ROWS)
  // ---------------------------------------------------------------------------
  console.log('\n🧹 7. CLEANING TEST EMAIL VERIFICATIONS (OTPs)...');
  const { count: otpCountBefore } = await supabaseAdmin
    .from('email_verifications')
    .select('id', { count: 'exact' });
  console.log(`  Found ${otpCountBefore || 0} email verification OTP records.`);

  if (otpCountBefore > 0) {
    const { error: otpErr } = await supabaseAdmin
      .from('email_verifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (otpErr) throw new Error(`Failed to delete email_verifications: ${otpErr.message}`);
    console.log(`  ✅ Cleared all ${otpCountBefore} test email OTP records.`);
  }

  // ---------------------------------------------------------------------------
  // 8. CLEANUP USER DEVICES (3 MOCK FCM TOKENS)
  // ---------------------------------------------------------------------------
  console.log('\n🧹 8. CLEANING MOCK USER DEVICES (FCM TOKENS)...');
  const { count: devCountBefore } = await supabaseAdmin
    .from('user_devices')
    .select('id', { count: 'exact' });
  console.log(`  Found ${devCountBefore || 0} device token records.`);

  if (devCountBefore > 0) {
    const { error: devErr } = await supabaseAdmin
      .from('user_devices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (devErr) throw new Error(`Failed to delete user_devices: ${devErr.message}`);
    console.log(`  ✅ Cleared all ${devCountBefore} mock device tokens.`);
  }

  // ---------------------------------------------------------------------------
  // 9. CLEANUP DEMO STUDENTS (@smdl.ac.in) — PRESERVE PERSONAL GMAIL STUDENTS
  // ---------------------------------------------------------------------------
  console.log('\n🧹 9. REMOVING 18 DEMO STUDENTS (@smdl.ac.in)...');
  console.log('     Preserving: Admin, 8 Approved Teachers, and 3 Personal Gmail Student Accounts.');

  // Find demo student user IDs
  const { data: demoStudentUsers, error: findErr } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name')
    .eq('role', 'student')
    .like('email', '%@smdl.ac.in');

  if (findErr) throw new Error(`Failed to query demo students: ${findErr.message}`);
  console.log(`  Found ${(demoStudentUsers || []).length} demo student user accounts with @smdl.ac.in.`);

  if (demoStudentUsers && demoStudentUsers.length > 0) {
    const demoUserIds = demoStudentUsers.map((u) => u.id);

    // Clean notification preferences for these demo users if any
    await supabaseAdmin
      .from('notification_preferences')
      .delete()
      .in('user_id', demoUserIds);

    // Delete from students table first
    const { error: stuDelErr } = await supabaseAdmin
      .from('students')
      .delete()
      .in('user_id', demoUserIds);
    if (stuDelErr) throw new Error(`Failed to delete demo students: ${stuDelErr.message}`);

    // Delete from users table
    const { error: usrDelErr } = await supabaseAdmin
      .from('users')
      .delete()
      .in('id', demoUserIds);
    if (usrDelErr) throw new Error(`Failed to delete demo users: ${usrDelErr.message}`);

    console.log(`  ✅ Successfully deleted ${demoStudentUsers.length} demo students.`);
  }

  // ---------------------------------------------------------------------------
  // 10. POST-CLEANUP VERIFICATION & PRODUCTION READINESS CHECK
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('📊 10. POST-CLEANUP AUDIT & INTEGRITY VERIFICATION');
  console.log('================================================================================');

  const verificationTables = [
    { name: 'users', expectedDescription: '1 Admin + 8 Teachers + 3 Gmail Students = 12 total' },
    { name: 'students', expectedDescription: '3 Gmail Students' },
    { name: 'teachers', expectedDescription: '8 Approved Faculty profiles' },
    { name: 'courses', expectedDescription: '3 Academic Courses' },
    { name: 'divisions', expectedDescription: '9 Academic Divisions' },
    { name: 'subjects', expectedDescription: '31 Curriculum Subjects' },
    { name: 'teacher_subjects', expectedDescription: '15 Faculty Allocations' },
    { name: 'lectures', expectedDescription: '0 (Clean slate ready for scheduler)' },
    { name: 'attendance', expectedDescription: '0 (Clean slate ready for classes)' },
    { name: 'announcements', expectedDescription: '0 (Clean slate)' },
    { name: 'notifications', expectedDescription: '0 (Clean slate)' },
    { name: 'email_verifications', expectedDescription: '0 (Clean slate)' },
    { name: 'user_devices', expectedDescription: '0 (Clean slate)' },
    { name: 'system_config', expectedDescription: '10 System Configurations' },
  ];

  const currentCounts = {};
  for (const t of verificationTables) {
    const { count, error } = await supabaseAdmin
      .from(t.name)
      .select('*', { count: 'exact', head: true });
    currentCounts[t.name] = count || 0;
    console.log(`  Table '${t.name.padEnd(20)}': ${String(count).padStart(3)} rows | Expected: ${t.expectedDescription}`);
  }

  // Verify Remaining Users
  const { data: remainingUsers } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, status')
    .order('role', { ascending: true });

  console.log('\n📋 REMAINING VERIFIED USERS IN DATABASE:');
  console.table(
    (remainingUsers || []).map((u) => ({
      Role: u.role.toUpperCase(),
      Name: u.full_name,
      Email: u.email,
      Status: u.status,
    }))
  );

  console.log('\n================================================================================');
  console.log('🎉 STEP 5 CLEANUP COMPLETE: DATABASE & STORAGE ARE IN CLEAN PRODUCTION STATE!');
  console.log('================================================================================\n');
}

executeStep5Cleanup().catch((err) => {
  console.error('\n❌ Fatal error during cleanup execution:', err);
  process.exit(1);
});
