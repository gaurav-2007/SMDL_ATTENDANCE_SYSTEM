const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const { supabaseAdmin } = require('../config/db');

let isFirebaseInitialized = false;
let lastInitError = null;

function extractCredentials(input) {
  if (!input || typeof input !== 'string') return null;
  let text = input.trim();

  // Strip wrapping quotes if any
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // Candidate parser: handles valid JSON as well as corrupted JSON via regex
  const parseCandidate = (candidate) => {
    if (!candidate || typeof candidate !== 'string') return null;

    // 1. Try standard JSON.parse
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && (parsed.private_key || parsed.privateKey)) {
        return parsed;
      }
    } catch (_e) {}

    // 2. Resilient Regex Fallback (extracts key, email, project even if cert_url or trailing json is corrupted)
    const pkMatch = candidate.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/);
    const emailMatch = candidate.match(/["']?client_email["']?\s*[:=]\s*["']([^"'\s]+)["']/i);
    const projMatch = candidate.match(/["']?project_id["']?\s*[:=]\s*["']([^"'\s]+)["']/i);

    if (pkMatch) {
      return {
        projectId: (projMatch && projMatch[1]) || process.env.FIREBASE_PROJECT_ID || 'gaurav-f685e',
        clientEmail: (emailMatch && emailMatch[1]) || process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@gaurav-f685e.iam.gserviceaccount.com',
        privateKey: pkMatch[0],
      };
    }

    return null;
  };

  // If input looks like Base64 (starts with "ey" or only valid b64 chars and long)
  if (text.startsWith('ey') || (/^[A-Za-z0-9+/=]+$/.test(text) && text.length > 200)) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      const b64Result = parseCandidate(decoded);
      if (b64Result) return b64Result;
    } catch (_e) {}
  }

  // Fallback to direct text parsing
  return parseCandidate(text);
}

function normalizeCert(credentials) {
  if (!credentials) return null;
  const rawKey = credentials.privateKey || credentials.private_key;
  if (!rawKey) return null;
  return {
    projectId: credentials.projectId || credentials.project_id || process.env.FIREBASE_PROJECT_ID || 'gaurav-f685e',
    clientEmail: credentials.clientEmail || credentials.client_email || process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@gaurav-f685e.iam.gserviceaccount.com',
    privateKey: rawKey.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n'),
  };
}

// Initialize Firebase Admin SDK safely
function initFirebaseAdmin() {
  if (isFirebaseInitialized) return true;

  if (admin.apps && admin.apps.length > 0) {
    isFirebaseInitialized = true;
    lastInitError = null;
    return true;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    const getCert = (admin.credential && typeof admin.credential.cert === 'function')
      ? admin.credential.cert
      : admin.cert;

    if (serviceAccountJson) {
      const trimmed = serviceAccountJson.trim();
      let credentials = extractCredentials(trimmed);

      if (!credentials) {
        // Assume file path (relative to server root or absolute)
        const resolvedPath = path.isAbsolute(trimmed)
          ? trimmed
          : path.resolve(__dirname, '../../', trimmed);
        credentials = require(resolvedPath);
      }

      const certConfig = normalizeCert(credentials);
      if (!certConfig || !certConfig.privateKey) {
        throw new Error('Service account does not contain a valid private key.');
      }

      admin.initializeApp({
        credential: getCert(certConfig),
      });
      isFirebaseInitialized = true;
      lastInitError = null;
      console.log('🔥 [fcmService] Firebase Admin initialized successfully via Service Account.');
      return true;
    }

    // Auto-discover serviceAccountKey.json in server root or config folder
    const candidatePaths = [
      path.resolve(__dirname, '../../serviceAccountKey.json'),
      path.resolve(__dirname, '../../firebase-service-account.json'),
      path.resolve(__dirname, '../config/serviceAccountKey.json'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const credentials = require(p);
          admin.initializeApp({
            credential: getCert(credentials),
          });
          isFirebaseInitialized = true;
          console.log(`🔥 [fcmService] Firebase Admin initialized via discovered key file: ${p}`);
          return true;
        } catch (_err) {}
      }
    }

    if (projectId && clientEmail && privateKey) {
      const certConfig = normalizeCert({
        projectId,
        clientEmail,
        privateKey,
      });

      admin.initializeApp({
        credential: getCert(certConfig),
      });
      isFirebaseInitialized = true;
      lastInitError = null;
      console.log('🔥 [fcmService] Firebase Admin initialized successfully via environment variables.');
      return true;
    }

    console.log('ℹ️ [fcmService] Firebase credentials not configured in server/.env — operating in In-App Only mode.');
    lastInitError = 'Firebase credentials not configured in environment variables.';
    return false;
  } catch (err) {
    console.warn('⚠️ [fcmService] Failed to initialize Firebase Admin SDK:', err.message);
    lastInitError = err.message;
    isFirebaseInitialized = false;
    return false;
  }
}

// Execute initial load check
initFirebaseAdmin();

/**
 * Send push notification to multiple device tokens (Web & Android ready)
 * @param {Array<{ fcm_token: string, device_type: string }>} devices 
 * @param {{ title: string, body: string, data?: object, notificationType?: string }} payload 
 */
async function sendMulticastPush(devices, { title, body, data = {}, notificationType = 'SYSTEM' }) {
  if (!initFirebaseAdmin() || !Array.isArray(devices) || devices.length === 0) {
    return { success: true, deliveredCount: 0, inAppOnly: true };
  }

  // Filter valid tokens
  const activeTokens = devices.map((d) => (typeof d === 'string' ? d : d.fcm_token)).filter(Boolean);
  if (activeTokens.length === 0) {
    return { success: true, deliveredCount: 0 };
  }

  // Stringify all data payload values for strict FCM compatibility (rejects undefined/null/non-strings)
  const cleanData = {};
  for (const [key, val] of Object.entries(data || {})) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      cleanData[key] = val;
    } else if (typeof val === 'boolean' || typeof val === 'number') {
      cleanData[key] = String(val);
    } else {
      cleanData[key] = JSON.stringify(val);
    }
  }
  cleanData.notificationType = String(notificationType || 'SYSTEM');
  cleanData.sentAt = new Date().toISOString();

  // Ensure direct deep link URL is always present under multiple standard keys for Android receivers
  const targetRoute = cleanData.actionUrl || cleanData.url || '/';
  cleanData.actionUrl = targetRoute;
  cleanData.url = targetRoute;
  cleanData.targetUrl = targetRoute;

  // Unified payload structure: Works for both Web and Android
  const multicastMessage = {
    tokens: activeTokens,
    notification: {
      title,
      body,
    },
    data: cleanData,
    webpush: {
      notification: {
        title,
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      },
      fcmOptions: {
        link: cleanData.actionUrl || '/',
      },
    },
    android: {
      priority: 'high',
      notification: {
        title,
        body,
        channelId: 'smdl_alerts',
        sound: 'default',
        priority: 'high',
        notificationPriority: 'PRIORITY_HIGH',
        visibility: 'PUBLIC',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
  };

  try {
    const messaging = typeof admin.messaging === 'function' ? admin.messaging() : getMessaging();
    const response = await messaging.sendEachForMulticast(multicastMessage);
    const failedTokens = [];

    console.log(`📡 [fcmService] FCM multicast dispatched to ${activeTokens.length} device(s). Success: ${response.successCount}, Failure: ${response.failureCount}`);

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.warn(`⚠️ [fcmService] Delivery failed for token [${idx}]:`, resp.error?.code, resp.error?.message);
        const errCode = resp.error?.code;
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token'
        ) {
          failedTokens.push(activeTokens[idx]);
        }
      }
    });

    // Deactivate obsolete tokens asynchronously
    if (failedTokens.length > 0) {
      deactivateTokens(failedTokens).catch(() => { });
    }

    return {
      success: true,
      deliveredCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err) {
    console.error('⚠️ [fcmService] Multicast send error:', err.message);
    return { success: false, error: err.message, inAppOnly: true };
  }
}

/**
 * Marks expired/unregistered FCM tokens as inactive
 */
async function deactivateTokens(tokens) {
  try {
    await supabaseAdmin
      .from('user_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('fcm_token', tokens);
  } catch (_e) {
    // Ignore db write warning
  }
}

module.exports = {
  sendMulticastPush,
  isFirebaseActive: () => isFirebaseInitialized,
  getLastInitError: () => lastInitError,
  initFirebaseAdmin,
  deactivateTokens,
};
