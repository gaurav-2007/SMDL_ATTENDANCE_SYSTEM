const path = require('path');
const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const { supabaseAdmin } = require('../config/db');

let isFirebaseInitialized = false;

// Initialize Firebase Admin SDK safely
function initFirebaseAdmin() {
  if (isFirebaseInitialized) return true;

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null;

    const getCert = (admin.credential && typeof admin.credential.cert === 'function')
      ? admin.credential.cert
      : admin.cert;

    if (serviceAccountJson) {
      let credentials;
      if (serviceAccountJson.trim().startsWith('{')) {
        credentials = JSON.parse(serviceAccountJson);
      } else {
        // Assume file path (relative to server root or absolute)
        const resolvedPath = path.isAbsolute(serviceAccountJson)
          ? serviceAccountJson
          : path.resolve(__dirname, '../../', serviceAccountJson);
        credentials = require(resolvedPath);
      }
      admin.initializeApp({
        credential: getCert(credentials),
      });
      isFirebaseInitialized = true;
      console.log('🔥 [fcmService] Firebase Admin initialized successfully via Service Account JSON.');
      return true;
    }

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: getCert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      isFirebaseInitialized = true;
      console.log('🔥 [fcmService] Firebase Admin initialized successfully via environment variables.');
      return true;
    }

    console.log('ℹ️ [fcmService] Firebase credentials not configured in server/.env — operating in In-App Only mode.');
    return false;
  } catch (err) {
    console.warn('⚠️ [fcmService] Failed to initialize Firebase Admin SDK:', err.message);
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
        channelId: 'smdl_alerts',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
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
      deactivateTokens(failedTokens).catch(() => {});
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
  initFirebaseAdmin,
  deactivateTokens,
};
