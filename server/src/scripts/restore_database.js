const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/db');

async function restoreDatabase(customFilePath) {
  const backupPath = customFilePath 
    ? path.resolve(customFilePath)
    : path.join(__dirname, '../../../backups/db_backup_latest.json');

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup file not found at: ${backupPath}`);
    process.exit(1);
  }

  console.log(`🔄 Reading backup from: ${backupPath}`);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log(`Backup created at: ${backup.backup_timestamp}`);

  // Tables to restore in dependency order
  const RESTORE_ORDER = [
    'courses',
    'divisions',
    'users',
    'teachers',
    'students',
    'subjects',
    'teacher_subjects',
    'division_timetables',
    'lectures',
    'attendance',
    'semester_switch_logs',
    'system_config'
  ];

  for (const table of RESTORE_ORDER) {
    const tableData = backup.tables?.[table];
    if (!tableData || !tableData.data || tableData.data.length === 0) {
      console.log(`  - Table [${table}]: No records to restore`);
      continue;
    }

    try {
      console.log(`  Restoring Table [${table}] (${tableData.data.length} records)...`);
      // Upsert records in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < tableData.data.length; i += chunkSize) {
        const chunk = tableData.data.slice(i, i + chunkSize);
        const { error } = await supabaseAdmin.from(table).upsert(chunk);
        if (error) {
          console.warn(`    ⚠️ Upsert warning on [${table}]:`, error.message);
        }
      }
      console.log(`  ✓ Table [${table}]: Restored successfully`);
    } catch (err) {
      console.error(`    ❌ Error restoring [${table}]:`, err.message);
    }
  }

  console.log('\n✅ Restore process completed!');
}

const targetFile = process.argv[2];
restoreDatabase(targetFile).then(() => process.exit(0)).catch(e => {
  console.error('Fatal restore error:', e);
  process.exit(1);
});
