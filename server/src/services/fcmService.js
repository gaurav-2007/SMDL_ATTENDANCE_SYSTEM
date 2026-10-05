const admin = require('firebase-admin');
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

    if (serviceAccountJson) {
      let credentials;
      if (serviceAccountJson.trim().startsWith('{')) {
        credentials = JSON.parse(serviceAccountJson);
      } else {
        // Assume file path
        credentials = require(serviceAccountJson);
      }
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      isFirebaseInitialized = true;
      console.log('🔥 [fcmService] Firebase Admin initialized successfully via Service Account JSON.');
      return true;
    }

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
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

  // Stringify all data payload values for FCM compatibility
  const cleanData = {};
  for (const [key, val] of Object.entries(data || {})) {
    cleanData[key] = typeof val === 'string' ? val : JSON.stringify(val);
  }
  cleanData.notificationType = notificationType;
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
    const response = await admin.messaging().sendEachForMulticast(multicastMessage);
    const failedTokens = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
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
};
