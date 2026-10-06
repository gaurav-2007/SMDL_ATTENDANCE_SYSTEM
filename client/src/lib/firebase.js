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

/**
 * Requests browser notification permission, retrieves FCM web push token,
 * and registers it with the backend server.
 */
export async function requestWebPushPermission() {
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
