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
    } catch (_e) { }
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
 * @desc    Direct download stream or responsive mobile landing page for Android APK
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

  const acceptHeader = req.get('accept') || '';
  const isDirect = req.query.direct === '1' || req.query.raw === '1' || req.query.download === '1';

  // If direct stream requested or caller is not a browser navigating for HTML
  if (isDirect || !acceptHeader.includes('text/html')) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${appVersionConfig.apkFilename || 'SMDL_Attendance_Latest.apk'}"`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(apkPath);
  }

  // Otherwise serve a lightweight, mobile-first landing page that triggers download reliably
  const stats = fs.existsSync(apkPath) ? fs.statSync(apkPath) : null;
  const apkSizeMb = stats ? Math.round((stats.size / (1024 * 1024)) * 10) / 10 : 7.5;
  const directDownloadUrl = `${req.baseUrl || '/api/app'}/download?direct=1`;
  const filename = appVersionConfig.apkFilename || 'SMDL_Attendance_Latest.apk';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Download SMDL Attendance Update</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      max-width: 420px;
      width: 100%;
      padding: 2rem 1.5rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge-icon {
      width: 60px;
      height: 60px;
      margin: 0 auto 1rem;
      background: linear-gradient(135deg, #10b981, #059669);
      border-radius: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      box-shadow: 0 8px 16px -4px rgba(16, 185, 129, 0.4);
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.35rem;
    }
    .version {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(52, 211, 153, 0.3);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 1rem;
    }
    .status-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.75rem;
      padding: 0.85rem;
      margin-bottom: 1.25rem;
      font-size: 0.85rem;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #34d399;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn {
      display: block;
      width: 100%;
      background: #10b981;
      color: #ffffff;
      font-weight: 700;
      font-size: 1rem;
      padding: 0.95rem 1.25rem;
      border-radius: 0.85rem;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .btn:active {
      transform: scale(0.98);
      background: #059669;
    }
    .guide {
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      text-align: left;
    }
    .guide h4 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }
    .guide ol {
      padding-left: 1.2rem;
      font-size: 0.8rem;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .guide strong { color: #f8fafc; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-icon">📱</div>
    <h1>SMDL Attendance System</h1>
    <div class="version">v${appVersionConfig.latestVersion || '1.0.6'} · Build ${appVersionConfig.latestVersionCode || '7'}</div>
    
    <div class="status-box" id="statusBox">
      <div class="spinner" id="spinner"></div>
      <span id="statusText">Starting download...</span>
    </div>

    <a href="${directDownloadUrl}" id="dlLink" class="btn">
      📥 Download APK (${apkSizeMb} MB)
    </a>

    <div class="guide">
      <h4>Installation Guide:</h4>
      <ol>
        <li>If Chrome asks <strong>"File might be harmful"</strong>, tap <strong>Download anyway</strong>.</li>
        <li>Tap <strong>Open</strong> from notification bar when download finishes.</li>
        <li>Tap <strong>Update</strong> to complete installation without losing data.</li>
      </ol>
    </div>
  </div>

  <script>
    (function() {
      var directUrl = "${directDownloadUrl}";
      var triggered = false;

      function triggerDownload() {
        if (triggered) return;
        triggered = true;
        var a = document.createElement('a');
        a.href = directUrl;
        a.setAttribute('download', "${filename}");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(function() {
          var spinner = document.getElementById('spinner');
          var text = document.getElementById('statusText');
          if (spinner) spinner.style.display = 'none';
          if (text) text.innerText = 'Download initiated! If not started, tap the green button.';
        }, 1200);
      }

      window.addEventListener('load', function() {
        setTimeout(triggerDownload, 350);
      });

      document.getElementById('dlLink').addEventListener('click', function() {
        var text = document.getElementById('statusText');
        if (text) text.innerText = 'Downloading APK...';
      });
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(html);
});

module.exports = router;
