const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/db');

const TABLES = [
  'users',
  'courses',
  'divisions',
  'teachers',
  'teacher_subjects',
  'students',
  'subjects',
  'division_timetables',
  'lectures',
  'attendance',
  'semester_switch_logs',
  'lecture_notification_logs',
  'notifications',
  'geofence_settings',
  'system_config'
];

async function backupDatabase() {
  console.log('🔄 Starting full database backup...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../../../backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupData = {
    backup_timestamp: new Date().toISOString(),
    tables: {}
  };

  for (const table of TABLES) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('*');
      if (error) {
        console.warn(`⚠️ Table [${table}] query warning:`, error.message);
        backupData.tables[table] = { count: 0, data: [], error: error.message };
      } else {
        backupData.tables[table] = { count: data.length, data: data };
        console.log(`  ✓ Table [${table}]: ${data.length} records backed up`);
      }
    } catch (err) {
      console.warn(`⚠️ Table [${table}] exception:`, err.message);
      backupData.tables[table] = { count: 0, data: [], error: err.message };
    }
  }

  const backupFileName = `db_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');

  // Also write to a persistent "latest" pointer
  const latestFilePath = path.join(backupDir, 'db_backup_latest.json');
  fs.writeFileSync(latestFilePath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log(`\n✅ Backup successfully saved to:\n   ${backupFilePath}`);
  console.log(`   ${latestFilePath}`);
}

backupDatabase().then(() => process.exit(0)).catch(e => {
  console.error('Fatal backup error:', e);
  process.exit(1);
});
