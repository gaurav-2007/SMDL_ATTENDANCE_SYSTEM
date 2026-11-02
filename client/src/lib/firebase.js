import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
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

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

// Guard to prevent repeated taps from triggering overlapping registration attempts
let isPushRegistering = false

/**
 * Requests notification permission, retrieves FCM token,
 * registers Android notification channel, and registers token with backend.
 */
export async function requestWebPushPermission() {
  // --- NATIVE ANDROID FCM WORKFLOW (Capacitor) ---
  if (Capacitor.isNativePlatform()) {
    if (isPushRegistering) {
      return { supported: true, granted: false, reason: 'Push notification registration already in progress' }
    }
    isPushRegistering = true

    try {
      // 1. Create native Android notification channel matching backend fcmService
      await PushNotifications.createChannel({
        id: 'smdl_alerts',
        name: 'SMDL Campus Alerts',
        description: 'Attendance alerts, lecture notifications, and campus updates',
        importance: 5,
        visibility: 1,
        vibration: true,
      }).catch((e) => console.warn('[firebase.js] Channel create warning:', e.message))

      // 2. Request runtime push permission (Android 13+)
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions()
      }

      if (permStatus.receive !== 'granted') {
        isPushRegistering = false
        return { supported: true, granted: false, reason: 'Push notification permission denied by user' }
      }

      // 3. Register with Google FCM and await token or error with single-use listener cleanup
      return await new Promise((resolve) => {
        let settled = false
        let regListener = null
        let errListener = null

        const cleanup = () => {
          if (regListener?.remove) regListener.remove()
          if (errListener?.remove) errListener.remove()
          clearTimeout(timeoutId)
          isPushRegistering = false
        }

        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true
            cleanup()
            resolve({
              supported: true,
              granted: false,
              reason: 'Push notification registration timed out. Please check network/Google Play Services.',
            })
          }
        }, 15000)

        Promise.all([
          PushNotifications.addListener('registration', async (token) => {
            if (settled) return
            settled = true
            const nativeToken = token?.value
            if (nativeToken) {
              localStorage.setItem('smdl_fcm_token', nativeToken)
              try {
                await api.post('/notifications/devices', {
                  fcm_token: nativeToken,
                  device_type: 'ANDROID',
                  device_name: 'Android Device',
                })
              } catch (_e) {
                // Token registration recorded locally
              }
            }
            cleanup()
            resolve({ supported: true, granted: true, token: nativeToken })
          }),
          PushNotifications.addListener('registrationError', (err) => {
            if (settled) return
            settled = true
            console.warn('[firebase.js] Native FCM registration error:', err?.error || err)
            cleanup()
            resolve({
              supported: true,
              granted: false,
              error: err?.error || err?.message || 'Push notification registration failed',
              reason: err?.error || err?.message || 'Push notification registration failed',
            })
          }),
        ]).then(([regHandle, errHandle]) => {
          regListener = regHandle
          errListener = errHandle

          // Trigger native register() only after listeners are established
          PushNotifications.register().catch((regErr) => {
            if (settled) return
            settled = true
            console.warn('[firebase.js] PushNotifications.register() call rejected:', regErr?.message || regErr)
            cleanup()
            resolve({
              supported: true,
              granted: false,
              error: regErr?.message || 'Push notification service unavailable',
              reason: regErr?.message || 'Push notification service unavailable',
            })
          })
        }).catch((listenerErr) => {
          if (settled) return
          settled = true
          cleanup()
          resolve({
            supported: true,
            granted: false,
            error: listenerErr?.message,
            reason: 'Failed to initialize notification listeners',
          })
        })
      })
    } catch (err) {
      isPushRegistering = false
      console.warn('[firebase.js] Native push exception:', err.message)
      return { supported: true, granted: false, error: err.message, reason: err.message }
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
      // Store locally for lifecycle management
      localStorage.setItem('smdl_fcm_token', currentToken);

      // Register token with backend API
      await api.post('/notifications/devices', {
        fcm_token: currentToken,
        device_type: 'WEB',
        device_name: `${navigator.userAgent.slice(0, 100)}`,
      });

      return { supported: true, granted: true, token: currentToken };
    }

    return { supported: true, granted: true, token: null, reason: 'No registration token available' };
  } catch (err) {
    console.warn('[firebase.js] Web push permission/token error:', err.message);
    return { supported: true, granted: false, error: err.message };
  }
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
 * Foreground message listener callback
 */
export function onMessageListener(callback) {
  let unsubscribe = () => {};
  getFirebaseMessaging().then((msgInstance) => {
    if (msgInstance) {
      unsubscribe = onMessage(msgInstance, (payload) => {
        if (typeof callback === 'function') {
          callback(payload);
        }
      });
    }
  });

  return () => {
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}
