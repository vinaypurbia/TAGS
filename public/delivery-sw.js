// public/delivery-sw.js
// Service Worker — handles incoming Web Push notifications for delivery alerts
// Place this file in your /public folder so it's served at /delivery-sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '🚚 Delivery Update', body: 'An order has been delivered.' };

  try {
    if (event.data) {
      data = JSON.parse(event.data.text());
    }
  } catch {}

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',   // use your existing app icon
    badge: '/icons/icon-72x72.png',
    tag: data.orderId ? `delivery-${data.orderId}` : 'delivery',
    renotify: true,
    requireInteraction: true,          // stays on screen until dismissed
    vibrate: [200, 100, 200],
    data: { orderId: data.orderId, url: '/admin' },
    actions: [
      { action: 'view', title: '📋 View Order' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open or focus the admin panel
  const targetUrl = event.notification.data?.url || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
