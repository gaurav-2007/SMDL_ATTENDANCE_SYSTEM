import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from './api';

// Public Web Client Configuration (Safe for browser)
let clientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let clientVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app = null;
let messaging = null;

/**
 * Fetch public configuration from backend if missing in Vite env
 */
async function loadPublicConfig() {
  if (clientConfig.apiKey && clientConfig.projectId) {
    return { config: clientConfig, vapidKey: clientVapidKey };
  }

  try {
    const { data } = await api.get('/notifications/firebase-config');
    if (data?.data?.apiKey && data?.data?.projectId) {
      clientConfig = {
        apiKey: data.data.apiKey,
        authDomain: data.data.authDomain,
        projectId: data.data.projectId,
        storageBucket: data.data.storageBucket,
        messagingSenderId: data.data.messagingSenderId,
        appId: data.data.appId,
      };
      if (data.data.vapidKey) {
        clientVapidKey = data.data.vapidKey;
      }
    }
  } catch (_e) {
    // Backend endpoint unreachable or not yet ready
  }

  return { config: clientConfig, vapidKey: clientVapidKey };
}

// Initialize Firebase client safely
async function getFirebaseMessaging() {
  if (messaging) return messaging;

  const { config } = await loadPublicConfig();
  if (config.apiKey && config.projectId) {
    try {
      app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
      messaging = getMessaging(app);
      return messaging;
    } catch (err) {
      console.warn('[firebase.js] Messaging init warning:', err.message);
    }
  }
  return null;
}

// Guard to prevent repeated taps from triggering overlapping registration attempts
let isPushRegistering = false;

/**
 * Sends FCM token to backend API to persist in user_devices table
 */
async function registerTokenWithBackend(fcmToken, deviceType = 'WEB', deviceName = 'Device') {
  if (!fcmToken) return;
  try {
    await api.post('/notifications/devices', {
      fcm_token: fcmToken,
      device_type: deviceType,
      device_name: deviceName,
    });
  } catch (err) {
    console.warn('[firebase.js] Backend device token registration notice:', err?.response?.data?.message || err.message);
  }
}

/**
 * Ensures native notification channel exists on Android (matches backend fcmService)
 */
async function ensureAndroidChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.createChannel({
      id: 'smdl_alerts',
      name: 'SMDL Campus Alerts',
      description: 'Attendance alerts, lecture notifications, and campus updates',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
  } catch (e) {
    console.warn('[firebase.js] Channel create warning:', e.message);
  }
}

/**
 * Requests notification permission, retrieves FCM token,
 * registers Android notification channel, and registers token with backend.
 */
export async function requestWebPushPermission() {
  // --- NATIVE ANDROID FCM WORKFLOW (Capacitor) ---
  if (Capacitor.isNativePlatform()) {
    if (isPushRegistering) {
      return { supported: true, granted: false, reason: 'Push notification registration already in progress' };
    }
    isPushRegistering = true;

    try {
      // 1. Create native Android notification channel
      await ensureAndroidChannel();

      // 2. Proactively re-sync cached token if available so backend stays active immediately
      const cachedToken = localStorage.getItem('smdl_fcm_token');
      if (cachedToken) {
        registerTokenWithBackend(cachedToken, 'ANDROID', 'Android Device');
      }

      // 3. Check and request runtime push permission (Android 13+)
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        isPushRegistering = false;
        return { supported: true, granted: false, reason: 'Push notification permission denied by user' };
      }

      // 4. Register with Google FCM and await token with timeout safety
      return await new Promise((resolve) => {
        let settled = false;
        let regListener = null;
        let errListener = null;

        const cleanup = () => {
          if (regListener?.remove) regListener.remove();
          if (errListener?.remove) errListener.remove();
          clearTimeout(timeoutId);
          isPushRegistering = false;
        };

        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            if (cachedToken) {
              resolve({ supported: true, granted: true, token: cachedToken });
            } else {
              resolve({
                supported: true,
                granted: false,
                reason: 'Push notification registration timed out. Please check network/Google Play Services.',
              });
            }
          }
        }, 12000);

        Promise.all([
          PushNotifications.addListener('registration', async (token) => {
            if (settled) return;
            settled = true;
            const nativeToken = token?.value;
            if (nativeToken) {
              localStorage.setItem('smdl_fcm_token', nativeToken);
              await registerTokenWithBackend(nativeToken, 'ANDROID', 'Android Device');
            }
            cleanup();
            resolve({ supported: true, granted: true, token: nativeToken });
          }),
          PushNotifications.addListener('registrationError', (err) => {
            if (settled) return;
            settled = true;
            console.warn('[firebase.js] Native FCM registration error:', err?.error || err);
            cleanup();
            if (cachedToken) {
              resolve({ supported: true, granted: true, token: cachedToken });
            } else {
              resolve({
                supported: true,
                granted: false,
                error: err?.error || err?.message || 'Push notification registration failed',
                reason: err?.error || err?.message || 'Push notification registration failed',
              });
            }
          }),
        ]).then(([regHandle, errHandle]) => {
          regListener = regHandle;
          errListener = errHandle;

          // Trigger native register() only after listeners are established
          PushNotifications.register().catch((regErr) => {
            if (settled) return;
            settled = true;
            console.warn('[firebase.js] PushNotifications.register() call rejected:', regErr?.message || regErr);
            cleanup();
            if (cachedToken) {
              resolve({ supported: true, granted: true, token: cachedToken });
            } else {
              resolve({
                supported: true,
                granted: false,
                error: regErr?.message || 'Push notification service unavailable',
                reason: regErr?.message || 'Push notification service unavailable',
              });
            }
          });
        }).catch((listenerErr) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({
            supported: true,
            granted: false,
            error: listenerErr?.message,
            reason: 'Failed to initialize notification listeners',
          });
        });
      });
    } catch (err) {
      isPushRegistering = false;
      console.warn('[firebase.js] Native push exception:', err.message);
      return { supported: true, granted: false, error: err.message, reason: err.message };
    }
  }

  // --- WEB BROWSER WORKFLOW ---
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, reason: 'Notifications not supported in this browser' };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { supported: false, reason: 'Firebase Messaging not supported in this environment' };
  }

  const msgInstance = await getFirebaseMessaging();
  if (!msgInstance) {
    return { supported: false, reason: 'Firebase credentials not configured in client environment' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { supported: true, granted: false, reason: 'Notification permission denied by user' };
    }

    // Register service worker
    let swReg = null;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      if (swReg && swReg.active && clientConfig.apiKey) {
        swReg.active.postMessage({ type: 'FIREBASE_CONFIG', config: clientConfig });
      }
    }

    const tokenOptions = {
      serviceWorkerRegistration: swReg || undefined,
    };
    if (clientVapidKey) {
      tokenOptions.vapidKey = clientVapidKey;
    }

    const currentToken = await getToken(msgInstance, tokenOptions);

    if (currentToken) {
      localStorage.setItem('smdl_fcm_token', currentToken);
      await registerTokenWithBackend(currentToken, 'WEB', `${navigator.userAgent.slice(0, 100)}`);
      return { supported: true, granted: true, token: currentToken };
    }

    return { supported: true, granted: true, token: null, reason: 'No registration token available' };
  } catch (err) {
    console.warn('[firebase.js] Web push permission/token error:', err.message);
    return { supported: true, granted: false, error: err.message };
  }
}

/**
 * Passive sync: checks if notifications are already permitted and registers token without prompting
 */
export async function syncPushDeviceToken() {
  try {
    if (Capacitor.isNativePlatform()) {
      await ensureAndroidChannel();
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'granted') {
        return await requestWebPushPermission();
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      return await requestWebPushPermission();
    }
  } catch (e) {
    console.warn('[firebase.js] Passive push sync warning:', e.message);
  }
  return { supported: true, granted: false };
}

/**
 * Unregisters the current device token from backend on logout
 */
export async function unregisterWebPushToken() {
  if (typeof window === 'undefined') return;
  const currentToken = localStorage.getItem('smdl_fcm_token');
  if (currentToken) {
    try {
      await api.delete('/notifications/devices', {
        data: { fcm_token: currentToken },
      });
    } catch (_e) {
      // Ignore network errors during logout
    }
    localStorage.removeItem('smdl_fcm_token');
  }
}

/**
 * Foreground message listener callback (works seamlessly for both Web & Native Android)
 */
export function onMessageListener(callback) {
  let unsubscribeWeb = () => {};
  let nativeHandle = null;

  // 1. Native Android foreground push listener
  if (Capacitor.isNativePlatform()) {
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      if (typeof callback === 'function') {
        callback({
          notification: {
            title: notification.title || notification.data?.title || 'Notification',
            body: notification.body || notification.data?.body || notification.data?.message || '',
          },
          data: notification.data || {},
        });
      }
    }).then((handle) => {
      nativeHandle = handle;
    }).catch((e) => console.warn('[firebase.js] Native listener hook warning:', e.message));
  }

  // 2. Web foreground message listener
  getFirebaseMessaging().then((msgInstance) => {
    if (msgInstance) {
      unsubscribeWeb = onMessage(msgInstance, (payload) => {
        if (typeof callback === 'function') {
          callback(payload);
        }
      });
    }
  });

  return () => {
    if (nativeHandle?.remove) nativeHandle.remove();
    if (typeof unsubscribeWeb === 'function') unsubscribeWeb();
  };
}

/**
 * Global Android notification tap action listener
 */
export function setupNotificationTapListener(onTap) {
  if (!Capacitor.isNativePlatform()) return () => {};

  let handle = null;
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    if (typeof onTap === 'function') {
      onTap(action?.notification?.data || {});
    }
  }).then((h) => {
    handle = h;
  }).catch((e) => console.warn('[firebase.js] Tap listener warning:', e.message));

  return () => {
    if (handle?.remove) handle.remove();
  };
}
