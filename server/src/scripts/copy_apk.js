const fs = require('fs');
const path = require('path');

const src = 'C:/Users/grmou/.gradle/smld_build/app/outputs/apk/debug/app-debug.apk';
if (!fs.existsSync(src)) {
  console.error('Source APK does not exist:', src);
  process.exit(1);
}

const dests = [
  path.resolve(__dirname, '../../../SMDL_Attendance_Latest.apk'),
  path.resolve(__dirname, '../../public/SMDL_Attendance_Latest.apk'),
  path.resolve(__dirname, '../../../client/android/app/build/outputs/apk/debug/app-debug.apk'),
];

for (const dest of dests) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
  const stat = fs.statSync(dest);
  console.log(`[SUCCESS] Copied to: ${dest} (${stat.size} bytes, modified: ${stat.mtime})`);
}

process.exit(0);
