const { supabaseAdmin } = require('../config/db');

async function cleanDemoData() {
  console.log('🧹 Starting Demo Data Cleanup...');
  console.log('Preserving: Admin Account and Academic Structure (Courses, Divisions, Subjects).\n');

  try {
    // 1. Verify Admin user exists first to ensure we never delete admin
    const { data: adminUser, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('id, email, role, full_name')
      .eq('role', 'admin')
      .maybeSingle();

    if (adminErr || !adminUser) {
      throw new Error(`Admin user check failed: ${adminErr ? adminErr.message : 'No admin found!'}`);
    }
    console.log(`✅ Admin verified: ${adminUser.full_name} (${adminUser.email}, ID: ${adminUser.id})`);

    // 2. Clear attendance_audit_logs
    try {
      const { error } = await supabaseAdmin.from('attendance_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') console.warn('  ⚠️ attendance_audit_logs delete warning:', error.message);
      else console.log('✅ 1. Cleared attendance_audit_logs');
    } catch (e) {
      console.log('  ℹ️ attendance_audit_logs skipped:', e.message);
    }

    // 3. Clear attendance_records
    try {
      const { error } = await supabaseAdmin.from('attendance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') console.warn('  ⚠️ attendance_records delete warning:', error.message);
      else console.log('✅ 2. Cleared attendance_records');
    } catch (e) {
      console.log('  ℹ️ attendance_records skipped:', e.message);
    }

    // 4. Clear attendance
    const { error: attErr } = await supabaseAdmin
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (attErr) console.warn('  ⚠️ attendance delete warning:', attErr.message);
    else console.log('✅ 3. Cleared attendance');

    // 5. Clear lectures
    const { error: lecErr } = await supabaseAdmin
      .from('lectures')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (lecErr) console.warn('  ⚠️ lectures delete warning:', lecErr.message);
    else console.log('✅ 4. Cleared lectures');

    // 6. Clear division_timetables
    try {
      const { error } = await supabaseAdmin.from('division_timetables').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') console.warn('  ⚠️ division_timetables delete warning:', error.message);
      else console.log('✅ 5. Cleared division_timetables');
    } catch (e) {
      console.log('  ℹ️ division_timetables skipped:', e.message);
    }

    // 7. Clear announcements
    const { error: annErr } = await supabaseAdmin
      .from('announcements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (annErr) console.warn('  ⚠️ announcements delete warning:', annErr.message);
    else console.log('✅ 6. Cleared announcements');

    // 8. Clear notifications if table exists
    try {
      const { error } = await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') console.warn('  ⚠️ notifications delete warning:', error.message);
      else console.log('✅ 7. Cleared notifications');
    } catch (e) {
      console.log('  ℹ️ notifications skipped:', e.message);
    }

    // 9. Clear teacher_subjects
    const { error: tsErr } = await supabaseAdmin
      .from('teacher_subjects')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (tsErr) console.warn('  ⚠️ teacher_subjects delete warning:', tsErr.message);
    else console.log('✅ 8. Cleared teacher_subjects');

    // 10. Clear students
    const { error: stuErr } = await supabaseAdmin
      .from('students')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (stuErr) console.warn('  ⚠️ students delete warning:', stuErr.message);
    else console.log('✅ 9. Cleared students');

    // 11. Clear teachers
    const { error: tchErr } = await supabaseAdmin
      .from('teachers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (tchErr) console.warn('  ⚠️ teachers delete warning:', tchErr.message);
    else console.log('✅ 10. Cleared teachers');

    // 12. Clear users except admin
    const { error: usrErr } = await supabaseAdmin
      .from('users')
      .delete()
      .neq('role', 'admin');
    if (usrErr) console.warn('  ⚠️ non-admin users delete warning:', usrErr.message);
    else console.log('✅ 11. Cleared all non-admin users (kept Admin)');

    // 13. Verification Report
    console.log('\n───────────────── Verification ─────────────────');
    const tablesToCheck = [
      { name: 'users', expected: '1 (Admin only)' },
      { name: 'students', expected: '0' },
      { name: 'teachers', expected: '0' },
      { name: 'teacher_subjects', expected: '0' },
      { name: 'lectures', expected: '0' },
      { name: 'attendance', expected: '0' },
      { name: 'announcements', expected: '0' },
      { name: 'courses (Structure)', expected: '4 (Intact)' },
      { name: 'divisions (Structure)', expected: '10 (Intact)' },
      { name: 'subjects (Structure)', expected: '41 (Intact)' },
    ];

    for (const t of tablesToCheck) {
      const tblName = t.name.split(' ')[0];
      const { count, error } = await supabaseAdmin.from(tblName).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`  ${t.name.padEnd(24)}: Error (${error.message})`);
      } else {
        console.log(`  ${t.name.padEnd(24)}: ${count} rows (Expected: ${t.expected})`);
      }
    }

    const { data: remainingUsers } = await supabaseAdmin.from('users').select('id, email, role, full_name');
    console.log('\nRemaining Users in Database:');
    console.table(remainingUsers);

    console.log('\n✨ All demo data successfully deleted while preserving structure and admin account!');
  } catch (err) {
    console.error('\n❌ Error during cleanup:', err.message);
    process.exitCode = 1;
  }
}

cleanDemoData();
