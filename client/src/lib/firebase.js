import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import api from './api';

// Public Web Client Configuration (Safe for browser)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app = null;
let messaging = null;

// Initialize Firebase client safely
function getFirebaseMessaging() {
  if (messaging) return messaging;

  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
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

  const msgInstance = getFirebaseMessaging();
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
    }

    const tokenOptions = {
      serviceWorkerRegistration: swReg || undefined,
    };
    if (VAPID_KEY) {
      tokenOptions.vapidKey = VAPID_KEY;
    }

    const currentToken = await getToken(msgInstance, tokenOptions);

    if (currentToken) {
      // Register token with backend
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
 * Foreground message listener callback
 */
export function onMessageListener(callback) {
  const msgInstance = getFirebaseMessaging();
  if (!msgInstance) return () => {};

  return onMessage(msgInstance, (payload) => {
    if (typeof callback === 'function') {
      callback(payload);
    }
  });
}
