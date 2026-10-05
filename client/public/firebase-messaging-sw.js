// =====================================================================
// SMDL College Smart Attendance System - Service Worker
// Production-Safe Firebase Cloud Messaging Background Notification Handler
// =====================================================================

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Self-contained default configuration; will not fail if parameters are omitted
const defaultConfig = {
  apiKey: "AIzaSyDummyKeyForServiceWorkerInitOnly",
  projectId: "smdl-attendance",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(defaultConfig);
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || 'SMDL Attendance';
    const body = payload.notification?.body || payload.data?.body || 'New notification received';
    const icon = payload.notification?.icon || '/favicon.svg';

    const notificationOptions = {
      body,
      icon,
      badge: '/favicon.svg',
      data: payload.data || {},
      tag: payload.data?.notificationId || 'smdl-notification',
      renotify: true,
    };

    self.registration.showNotification(title, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw] SW initialization notice:', err);
}

// Handle notification click: focus or open app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.actionUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
