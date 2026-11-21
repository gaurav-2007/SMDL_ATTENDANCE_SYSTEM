const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const appVersionConfig = require('../config/appVersion');

/**
 * Resolve the latest APK file path on disk
 */
function getApkFilePath() {
  const candidatePaths = [
    path.resolve(__dirname, '../../public/SMDL_Attendance_Latest.apk'),
    path.resolve(__dirname, '../../public/app-debug.apk'),
    path.resolve(__dirname, '../../../SMDL_Attendance_Latest.apk'),
    path.resolve(__dirname, '../../../client/public/SMDL_Attendance_Latest.apk'),
    path.resolve(__dirname, '../../../client/public/app-debug.apk'),
    path.resolve(__dirname, '../../client/public/app-debug.apk'),
    path.resolve(process.cwd(), 'public/SMDL_Attendance_Latest.apk'),
    path.resolve(process.cwd(), 'public/app-debug.apk'),
    path.resolve(process.cwd(), 'server/public/SMDL_Attendance_Latest.apk'),
    path.resolve(process.cwd(), 'client/public/app-debug.apk'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * @route   GET /api/app/version
 * @desc    Get latest Android APK version info, release notes & download URL
 * @access  Public (No Auth required)
 */
router.get('/version', (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const downloadUrl = `${protocol}://${host}/api/app/download`;

  const apkPath = getApkFilePath();
  let apkSizeMb = 7.5;
  if (apkPath) {
    try {
      const stats = fs.statSync(apkPath);
      apkSizeMb = Math.round((stats.size / (1024 * 1024)) * 10) / 10;
    } catch (_e) {}
  }

  res.json({
    success: true,
    data: {
      latestVersion: appVersionConfig.latestVersion,
      latestVersionCode: appVersionConfig.latestVersionCode,
      minSupportedVersionCode: appVersionConfig.minSupportedVersionCode,
      mandatory: appVersionConfig.mandatory,
      releaseNotes: appVersionConfig.releaseNotes,
      downloadUrl,
      apkSizeMb,
      publishedAt: appVersionConfig.publishedAt,
    },
  });
});

/**
 * @route   GET /api/app/download
 * @desc    Direct download stream for the latest compiled Android APK
 * @access  Public (No Auth required)
 */
router.get('/download', (req, res) => {
  const apkPath = getApkFilePath();

  if (!apkPath) {
    res.status(404).json({
      success: false,
      message: 'APK file currently unavailable on this mirror. Please contact administrator.',
    });
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${appVersionConfig.apkFilename || 'SMDL_Attendance_Latest.apk'}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  res.sendFile(apkPath);
});

module.exports = router;
