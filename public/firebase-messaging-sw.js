importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCnf9zvt-ugfi-2O7vh_gnu2xBBGDutgjk",
  authDomain: "tags-1b80a.firebaseapp.com",
  projectId: "tags-1b80a",
  storageBucket: "tags-1b80a.firebasestorage.app",
  messagingSenderId: "224517071102",
  appId: "1:224517071102:web:79c9f72ee36c5657f805af"
});

const messaging = firebase.messaging();

// Handle background notifications (app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'TAGS', {
    body: body || '',
    icon: icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open TAGS' },
      { action: 'close', title: 'Dismiss' }
    ]
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
