// =====================================================================
// SMDL College Smart Attendance System - Production Web Service Worker
// Production-Ready Firebase Cloud Messaging & Web Push Notification Handler
// =====================================================================

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

let messagingInitialized = false;

function initFirebase(config) {
  if (messagingInitialized || !config || !config.apiKey || !config.projectId) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'SMDL Smart Attendance';
      const body = payload.notification?.body || payload.data?.body || 'New notification received';
      const icon = payload.notification?.icon || '/favicon.svg';

      const notificationOptions = {
        body,
        icon,
        badge: '/favicon.svg',
        data: payload.data || {},
        tag: payload.data?.notificationId || `smdl-${Date.now()}`,
        renotify: true,
      };

      return self.registration.showNotification(title, notificationOptions);
    });
    messagingInitialized = true;
  } catch (err) {
    console.warn('[firebase-messaging-sw] Init warning:', err.message);
  }
}

// Fetch public web config from backend (contains NO private keys or secrets)
fetch('/api/notifications/firebase-config')
  .then((res) => (res.ok ? res.json() : null))
  .then((body) => {
    if (body?.data?.apiKey && body?.data?.projectId) {
      initFirebase(body.data);
    }
  })
  .catch(() => {});

// Listen for config passed from client via postMessage
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && event.data.config) {
    initFirebase(event.data.config);
  }
});

// Fallback native push event handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_e) {
    payload = { notification: { title: 'SMDL Attendance', body: event.data.text() } };
  }

  // If Firebase compat SDK already handled this message, skip duplicate display
  if (payload.from && payload.fcmMessageId) {
    // FCM payload - handled by onBackgroundMessage
    return;
  }

  const title = payload.notification?.title || payload.data?.title || payload.title || 'SMDL Attendance';
  const body = payload.notification?.body || payload.data?.body || payload.body || 'New alert received';
  const icon = payload.notification?.icon || payload.data?.icon || '/favicon.svg';

  const options = {
    body,
    icon,
    badge: '/favicon.svg',
    data: payload.data || payload,
    tag: payload.data?.notificationId || payload.notificationId || `smdl-${Date.now()}`,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler: Open / focus correct application page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.actionUrl || data.url || '/';

  // Fallback URL resolution from notificationType if actionUrl wasn't explicit
  if (targetUrl === '/' && data.notificationType) {
    const type = data.notificationType.toUpperCase();
    if (['ANNOUNCEMENT', 'NEW_STUDY_MATERIAL', 'STUDY_MATERIAL'].includes(type)) {
      targetUrl = '/student/announce';
    } else if (['ATTENDANCE_MARKED', 'ATTENDANCE_CORRECTED', 'ATTENDANCE_REMOVED'].includes(type)) {
      targetUrl = '/student/attendance';
    } else if (['LOW_ATTENDANCE'].includes(type)) {
      targetUrl = '/student/reports';
    } else if (['LECTURE_STARTING'].includes(type)) {
      targetUrl = '/student/mark';
    } else if (['TEACHER_APPROVED'].includes(type)) {
      targetUrl = '/teacher';
    } else if (['TEACHER_REJECTED'].includes(type)) {
      targetUrl = '/pending-approval';
    } else if (['PASSWORD_RESET'].includes(type)) {
      targetUrl = '/reset-password';
    }
  }

  const destination = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If an existing window/tab on this origin is open, navigate it and bring to front
      for (const client of windowClients) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(destination).then(() => client.focus());
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(destination);
      }
    })
  );
});
