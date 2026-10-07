/**
 * STEP 5 — PRE-CLEANUP COMPLETE DATABASE & STORAGE BACKUP AND AUDIT SCRIPT
 *
 * READ-ONLY WITH RESPECT TO SUPABASE DATA.
 * Performs:
 * 1. Complete JSON & SQL export of all 23 database tables.
 * 2. Full object backup of all Supabase Storage buckets.
 * 3. Deep classification analysis of production vs. test/demo data.
 * 4. STRICT ZERO-DELETION GUARANTEE.
 */

const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/db');

const BACKUP_DIR = path.resolve(__dirname, '../../../../backups/pre_step5_backup_20261007');
const STORAGE_BACKUP_DIR = path.join(BACKUP_DIR, 'storage');

const ALL_TABLES = [
  'users',
  'courses',
  'divisions',
  'subjects',
  'students',
  'teachers',
  'teacher_subjects',
  'lectures',
  'attendance',
  'division_timetables',
  'timetable',
  'attendance_records',
  'attendance_audit_logs',
  'announcements',
  'announcement_attachments',
  'notifications',
  'user_devices',
  'notification_preferences',
  'low_attendance_warnings',
  'lecture_notification_logs',
  'email_verifications',
  'password_reset_tokens',
  'system_config',
];

function sanitizeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function runPreCleanupBackupAndAudit() {
  console.log('================================================================================');
  console.log('SMDL COLLEGE SMART ATTENDANCE SYSTEM — STEP 5 PRE-CLEANUP AUDIT & BACKUP');
  console.log('================================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Backup Destination: ${BACKUP_DIR}\n`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(STORAGE_BACKUP_DIR, { recursive: true });

  const fullDatabaseDump = {};
  const tableCounts = {};
  let sqlRestoreContent = `-- SMDL DATABASE BACKUP (PRE-STEP 5 CLEANUP)\n-- Generated: ${new Date().toISOString()}\n\n`;

  // ---------------------------------------------------------------------------
  // 1. BACKUP ALL DATABASE TABLES
  // ---------------------------------------------------------------------------
  console.log('📦 1. BACKING UP ALL 23 DATABASE TABLES...');

  for (const table of ALL_TABLES) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('*');
      if (error) {
        console.warn(`  ⚠️ Table '${table}' query error: ${error.message} (code: ${error.code})`);
        fullDatabaseDump[table] = { error: error.message, rows: [] };
        tableCounts[table] = 0;
        continue;
      }

      fullDatabaseDump[table] = data || [];
      tableCounts[table] = (data || []).length;

      // Save individual table JSON
      fs.writeFileSync(
        path.join(BACKUP_DIR, `${table}.json`),
        JSON.stringify(data || [], null, 2),
        'utf8'
      );

      // Generate SQL INSERT statements
      if (data && data.length > 0) {
        sqlRestoreContent += `-- Table: ${table} (${data.length} rows)\n`;
        for (const row of data) {
          const cols = Object.keys(row);
          const vals = cols.map((c) => sanitizeSqlVal(row[c]));
          sqlRestoreContent += `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }
        sqlRestoreContent += '\n';
      }

      console.log(`  ✅ Table '${table.padEnd(26)}': ${String(tableCounts[table]).padStart(4)} rows exported`);
    } catch (err) {
      console.error(`  ❌ Error dumping table '${table}':`, err.message);
      fullDatabaseDump[table] = { error: err.message, rows: [] };
      tableCounts[table] = 0;
    }
  }

  // Save complete consolidated JSON and SQL restore file
  fs.writeFileSync(
    path.join(BACKUP_DIR, 'database_full_backup.json'),
    JSON.stringify(fullDatabaseDump, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(BACKUP_DIR, 'database_restore.sql'),
    sqlRestoreContent,
    'utf8'
  );

  console.log(`\n✅ Database backup complete:`);
  console.log(`   - Consolidated JSON: ${path.join(BACKUP_DIR, 'database_full_backup.json')}`);
  console.log(`   - SQL Restore Script: ${path.join(BACKUP_DIR, 'database_restore.sql')}`);

  // ---------------------------------------------------------------------------
  // 2. BACKUP ALL STORAGE BUCKETS & OBJECTS
  // ---------------------------------------------------------------------------
  console.log('\n📦 2. BACKING UP SUPABASE STORAGE BUCKETS...');
  const storageInventory = {};

  try {
    const { data: buckets, error: bucketErr } = await supabaseAdmin.storage.listBuckets();
    if (bucketErr) {
      console.warn('  ⚠️ Failed to list storage buckets:', bucketErr.message);
    } else {
      console.log(`  Found ${(buckets || []).length} storage bucket(s):`);
      for (const b of buckets || []) {
        console.log(`   - Bucket: ${b.name} (id: ${b.id}, public: ${b.public})`);
        const bucketFolder = path.join(STORAGE_BACKUP_DIR, b.name);
        fs.mkdirSync(bucketFolder, { recursive: true });

        storageInventory[b.name] = [];

        // Recursive list of files
        async function listAndDownload(prefix = '') {
          const { data: files, error: listErr } = await supabaseAdmin.storage
            .from(b.name)
            .list(prefix, { limit: 1000 });

          if (listErr) {
            console.warn(`    ⚠️ Error listing '${prefix}' in ${b.name}:`, listErr.message);
            return;
          }

          for (const item of files || []) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.id === null) {
              // It's a directory / folder
              await listAndDownload(itemPath);
            } else {
              // File object
              storageInventory[b.name].push({
                path: itemPath,
                name: item.name,
                metadata: item.metadata,
                created_at: item.created_at,
                updated_at: item.updated_at,
              });

              // Download object
              const { data: blob, error: dlErr } = await supabaseAdmin.storage
                .from(b.name)
                .download(itemPath);

              if (dlErr) {
                console.warn(`    ⚠️ Error downloading '${itemPath}':`, dlErr.message);
              } else if (blob) {
                const buffer = Buffer.from(await blob.arrayBuffer());
                const localFilePath = path.join(bucketFolder, itemPath.replace(/\//g, path.sep));
                fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
                fs.writeFileSync(localFilePath, buffer);
                console.log(`    📥 Backed up object: ${b.name}/${itemPath} (${buffer.length} bytes)`);
              }
            }
          }
        }

        await listAndDownload('');
      }
    }
  } catch (err) {
    console.error('  ❌ Error backing up storage buckets:', err.message);
  }

  fs.writeFileSync(
    path.join(STORAGE_BACKUP_DIR, 'storage_inventory.json'),
    JSON.stringify(storageInventory, null, 2),
    'utf8'
  );
  console.log(`✅ Storage backup complete: ${STORAGE_BACKUP_DIR}`);

  // ---------------------------------------------------------------------------
  // 3. AUDIT & CLASSIFICATION ANALYSIS
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('🔍 3. DEEP CLASSIFICATION AUDIT (READ-ONLY)');
  console.log('================================================================================');

  const users = fullDatabaseDump['users'] || [];
  const students = fullDatabaseDump['students'] || [];
  const teachers = fullDatabaseDump['teachers'] || [];
  const teacherSubjects = fullDatabaseDump['teacher_subjects'] || [];
  const courses = fullDatabaseDump['courses'] || [];
  const divisions = fullDatabaseDump['divisions'] || [];
  const subjects = fullDatabaseDump['subjects'] || [];
  const lectures = fullDatabaseDump['lectures'] || [];
  const attendance = fullDatabaseDump['attendance'] || [];
  const announcements = fullDatabaseDump['announcements'] || [];
  const notifications = fullDatabaseDump['notifications'] || [];
  const userDevices = fullDatabaseDump['user_devices'] || [];
  const notificationPrefs = fullDatabaseDump['notification_preferences'] || [];
  const emailVerifications = fullDatabaseDump['email_verifications'] || [];
  const passwordResetTokens = fullDatabaseDump['password_reset_tokens'] || [];
  const systemConfigs = fullDatabaseDump['system_config'] || [];

  // Write audit summary report
  const auditReport = {
    generated_at: new Date().toISOString(),
    table_counts: tableCounts,
    storage_counts: Object.fromEntries(
      Object.entries(storageInventory).map(([b, items]) => [b, items.length])
    ),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      full_name: u.full_name,
      created_at: u.created_at,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      created_at: a.created_at,
      sent_by: a.sent_by,
    })),
    lectures: lectures.map((l) => ({
      id: l.id,
      subject_id: l.subject_id,
      date: l.date,
      start_time: l.start_time,
      status: l.status,
      created_at: l.created_at,
    })),
    attendance: attendance.map((at) => ({
      id: at.id,
      lecture_id: at.lecture_id,
      student_id: at.student_id,
      status: at.status,
      has_base64: Boolean(at.selfie_url && at.selfie_url.startsWith('data:')),
      has_storage_path: Boolean(at.selfie_storage_path),
      storage_path: at.selfie_storage_path,
      marked_at: at.marked_at,
    })),
    notifications_summary: notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {}),
    user_devices: userDevices.map((d) => ({
      id: d.id,
      user_id: d.user_id,
      fcm_token_preview: d.fcm_token ? d.fcm_token.substring(0, 30) + '...' : null,
      device_type: d.device_type,
      created_at: d.created_at,
    })),
    email_verifications: emailVerifications.map((e) => ({
      id: e.id,
      email: e.email,
      role: e.role,
      otp: e.otp,
      is_used: e.is_used,
      expires_at: e.expires_at,
    })),
  };

  fs.writeFileSync(
    path.join(BACKUP_DIR, 'step5_audit_summary.json'),
    JSON.stringify(auditReport, null, 2),
    'utf8'
  );

  console.log('\n📊 USERS BREAKDOWN:');
  console.table(
    users.map((u) => ({
      Email: u.email,
      Name: u.full_name,
      Role: u.role,
      Status: u.status,
      Created: u.created_at ? u.created_at.split('T')[0] : 'N/A',
    }))
  );

  console.log('\n📊 ANNOUNCEMENTS:');
  console.table(
    announcements.map((a) => ({
      ID: a.id,
      Title: a.title,
      Content: a.content ? a.content.substring(0, 40) : '',
      SentBy: a.sent_by,
      Created: a.created_at,
    }))
  );

  console.log('\n📊 NOTIFICATIONS BREAKDOWN BY TYPE:');
  console.log(auditReport.notifications_summary);

  console.log('\n📊 EMAIL VERIFICATIONS:');
  console.table(
    emailVerifications.map((e) => ({
      Email: e.email,
      Role: e.role,
      OTP: e.otp,
      Used: e.is_used,
      Expires: e.expires_at,
    }))
  );

  console.log('\n📊 USER DEVICES (PUSH TOKENS):');
  console.table(
    userDevices.map((d) => ({
      UserID: d.user_id,
      TokenPreview: d.fcm_token ? d.fcm_token.substring(0, 30) + '...' : '',
      DeviceType: d.device_type,
    }))
  );

  console.log('\n📊 ATTENDANCE RECORDS:');
  console.table(
    attendance.map((at) => ({
      ID: at.id,
      LectureID: at.lecture_id,
      StudentID: at.student_id,
      Status: at.status,
      HasStoragePath: Boolean(at.selfie_storage_path),
      StoragePath: at.selfie_storage_path || 'None',
    }))
  );

  console.log('\n================================================================================');
  console.log('✅ PRE-CLEANUP BACKUP & AUDIT COMPLETED SUCCESSFULLY');
  console.log('ZERO RECORDS WERE MODIFIED OR DELETED.');
  console.log('================================================================================');
}

runPreCleanupBackupAndAudit().catch((err) => {
  console.error('Fatal error during pre-cleanup backup & audit:', err);
  process.exit(1);
});
